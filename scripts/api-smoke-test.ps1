$ErrorActionPreference = 'Stop'

function Get-ConfigValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [string[]]$Files = @('.env.local', '.env')
  )

  $envValue = [Environment]::GetEnvironmentVariable($Key)
  if (-not [string]::IsNullOrWhiteSpace($envValue)) {
    return $envValue.Trim()
  }

  foreach ($file in $Files) {
    if (-not (Test-Path $file)) {
      continue
    }

    $line = Get-Content $file | Where-Object { $_ -match ("^" + [Regex]::Escape($Key) + "=") } | Select-Object -First 1
    if ($line) {
      return ($line -replace ("^" + [Regex]::Escape($Key) + "="), '').Trim()
    }
  }

  return ''
}

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,

    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [string]$ContentType,

    [string]$Body,

    [hashtable]$Headers = @{},

    [switch]$AllowEmptyBody
  )

  $requestParams = @{
    Method = $Method
    Uri = $Uri
    UseBasicParsing = $true
    Headers = $Headers
  }

  if ($PSBoundParameters.ContainsKey('ContentType')) {
    $requestParams.ContentType = $ContentType
  }

  if ($PSBoundParameters.ContainsKey('Body')) {
    $requestParams.Body = $Body
  }

  $response = Invoke-WebRequest @requestParams

  if ([string]::IsNullOrWhiteSpace($response.Content)) {
    if ($AllowEmptyBody) {
      return $null
    }

    throw 'API returned an empty response body.'
  }

  return $response.Content | ConvertFrom-Json
}

try {
  $apiBaseUrl = Get-ConfigValue -Key 'VITE_API_URL'
  if ([string]::IsNullOrWhiteSpace($apiBaseUrl)) {
    throw 'VITE_API_URL was not found in .env.local/.env or environment variables.'
  }

  $smokeEmail = Get-ConfigValue -Key 'SMOKE_TEST_EMAIL'
  $smokePassword = Get-ConfigValue -Key 'SMOKE_TEST_PASSWORD'

  if ([string]::IsNullOrWhiteSpace($smokeEmail) -or [string]::IsNullOrWhiteSpace($smokePassword)) {
    throw 'Set SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD in environment variables or .env.local.'
  }

  $apiBaseUrl = $apiBaseUrl.TrimEnd('/')
  Write-Output ("API_BASE_URL=" + $apiBaseUrl)

  $loginPayload = @{ email = $smokeEmail; password = $smokePassword } | ConvertTo-Json -Depth 4
  $login = Invoke-JsonRequest -Method 'Post' -Uri ($apiBaseUrl + '/auth/login') -ContentType 'application/json' -Body $loginPayload

  $token = [string]$login.token
  if ([string]::IsNullOrWhiteSpace($token)) {
    throw 'Login succeeded but token is missing.'
  }

  $sessionUserId = [string]$login.session.user.id
  $sessionDisplayName = [string]$login.session.user.displayName
  $sessionEmail = [string]$login.session.user.email

  if ([string]::IsNullOrWhiteSpace($sessionUserId)) {
    throw 'Login succeeded but session.user.id is missing.'
  }

  $personValue = if (-not [string]::IsNullOrWhiteSpace($sessionDisplayName)) { $sessionDisplayName } else { $sessionEmail }
  $authHeaders = @{ Authorization = "Bearer " + $token }

  $id = 'api-smoke-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

  $activity = @{
    id = $id
    employeeUserId = $sessionUserId
    date = '31.03.2026'
    time = '13:10'
    name = 'API smoke create'
    person = $personValue
    objects = 'Smoke'
    eventType = 'internal'
    visibility = 'private'
  }

  $createPayload = @{ activity = $activity } | ConvertTo-Json -Depth 6
  $create = Invoke-JsonRequest -Method 'Post' -Uri ($apiBaseUrl + '/activities') -ContentType 'application/json' -Body $createPayload -Headers $authHeaders
  Write-Output ("CREATE_SUCCESS=" + $create.success)

  $list1 = Invoke-JsonRequest -Method 'Get' -Uri ($apiBaseUrl + '/activities') -Headers $authHeaders
  $found1 = @($list1.items | Where-Object { $_.id -eq $id }).Count
  Write-Output ("FOUND_AFTER_CREATE=" + $found1)

  $draftPayload = @{
    draft = @{
      date = '31.03.2026'
      time = '13:12'
      employeeName = $personValue
      meetingContent = 'Draft content'
      meetingFormat = 'Draft format'
      projects = @('Draft project', '')
      notificationsCount = '5'
      telegramSubscriptionsCount = '2'
      comment = 'Draft comment'
    }
  } | ConvertTo-Json -Depth 6

  $draftSave = Invoke-JsonRequest -Method 'Put' -Uri ($apiBaseUrl + '/report-drafts/' + $id) -ContentType 'application/json' -Body $draftPayload -Headers $authHeaders
  Write-Output ("DRAFT_SAVE_SUCCESS=" + $draftSave.success)

  $reportsState1 = Invoke-JsonRequest -Method 'Get' -Uri ($apiBaseUrl + '/reports') -Headers $authHeaders
  $draftExists = $null -ne $reportsState1.draftsByActivityId.$id
  Write-Output ("DRAFT_EXISTS_AFTER_SAVE=" + $draftExists)

  $updatedActivity = @{
    id = $id
    employeeUserId = $sessionUserId
    date = '31.03.2026'
    time = '13:15'
    name = 'API smoke updated'
    person = $personValue
    objects = 'Smoke'
    eventType = 'external'
    visibility = 'private'
  }

  $updatePayload = @{ activity = $updatedActivity } | ConvertTo-Json -Depth 6
  $update = Invoke-JsonRequest -Method 'Put' -Uri ($apiBaseUrl + '/activities/' + $id) -ContentType 'application/json' -Body $updatePayload -Headers $authHeaders
  Write-Output ("UPDATE_SUCCESS=" + $update.success)

  $list2 = Invoke-JsonRequest -Method 'Get' -Uri ($apiBaseUrl + '/activities') -Headers $authHeaders
  $row2 = $list2.items | Where-Object { $_.id -eq $id } | Select-Object -First 1
  Write-Output ("UPDATED_NAME=" + $row2.name)
  Write-Output ("UPDATED_EVENTTYPE=" + $row2.eventType)

  $reportPayload = @{
    report = @{
      date = '31.03.2026'
      time = '13:15'
      employeeName = $personValue
      meetingContent = 'Final report'
      meetingFormat = 'Presentation'
      projects = @('Project Alpha', 'Project Beta')
      notificationsCount = '10'
      telegramSubscriptionsCount = '3'
      comment = 'Saved from smoke test'
    }
  } | ConvertTo-Json -Depth 6

  $reportSave = Invoke-JsonRequest -Method 'Put' -Uri ($apiBaseUrl + '/reports/' + $id) -ContentType 'application/json' -Body $reportPayload -Headers $authHeaders
  Write-Output ("REPORT_SAVE_SUCCESS=" + $reportSave.success)

  $draftDelete = Invoke-JsonRequest -Method 'Delete' -Uri ($apiBaseUrl + '/report-drafts/' + $id) -Headers $authHeaders
  Write-Output ("DRAFT_DELETE_SUCCESS=" + $draftDelete.success)

  $reportsState2 = Invoke-JsonRequest -Method 'Get' -Uri ($apiBaseUrl + '/reports') -Headers $authHeaders
  $reportExists = $null -ne $reportsState2.reportsByActivityId.$id
  $draftExistsAfterDelete = $null -ne $reportsState2.draftsByActivityId.$id
  Write-Output ("REPORT_EXISTS_AFTER_SAVE=" + $reportExists)
  Write-Output ("DRAFT_EXISTS_AFTER_DELETE=" + $draftExistsAfterDelete)

  $delete = Invoke-JsonRequest -Method 'Delete' -Uri ($apiBaseUrl + '/activities/' + $id) -Headers $authHeaders
  Write-Output ("DELETE_SUCCESS=" + $delete.success)

  $list3 = Invoke-JsonRequest -Method 'Get' -Uri ($apiBaseUrl + '/activities') -Headers $authHeaders
  $found3 = @($list3.items | Where-Object { $_.id -eq $id }).Count
  Write-Output ("FOUND_AFTER_DELETE=" + $found3)

  $isPass = (
    $create.success -and
    $draftSave.success -and
    $draftExists -and
    $update.success -and
    $reportSave.success -and
    $draftDelete.success -and
    $reportExists -and
    -not $draftExistsAfterDelete -and
    $delete.success -and
    $found1 -ge 1 -and
    $found3 -eq 0
  )

  if ($isPass) {
    Write-Output 'API_AUTH_FLOW_SMOKE: PASS'
    exit 0
  }

  Write-Output 'API_AUTH_FLOW_SMOKE: FAIL'
  exit 1
} catch {
  Write-Output ("API_AUTH_FLOW_SMOKE_ERROR: " + $_.Exception.Message)
  exit 1
}
