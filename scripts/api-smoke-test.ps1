$ErrorActionPreference = 'Stop'

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,

    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [string]$ContentType,

    [string]$Body,

    [switch]$AllowEmptyBody
  )

  $requestParams = @{
    Method = $Method
    Uri = $Uri
    UseBasicParsing = $true
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
  $envLines = Get-Content .env.local
  $apiLine = $envLines | Where-Object { $_ -match '^VITE_API_URL=' } | Select-Object -First 1

  if ($apiLine) {
    $url = $apiLine -replace '^VITE_API_URL=', ''
  } else {
    throw 'VITE_API_URL was not found in .env.local'
  }

  Write-Output ("URL=" + $url)

  $id = 'ui-check-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

  $activity = @{
    id = $id
    date = '31.03.2026'
    time = '13:10'
    name = 'UI check create'
    person = 'QA'
    objects = 'Smoke'
    eventType = 'internal'
  }

  $createPayload = @{ activity = $activity } | ConvertTo-Json -Depth 6
  $create = Invoke-JsonRequest -Method 'Post' -Uri ($url + '/activities') -ContentType 'application/json' -Body $createPayload

  Write-Output ("CREATE_SUCCESS=" + $create.success)

  $list1 = Invoke-JsonRequest -Method 'Get' -Uri ($url + '/activities')

  $found1 = @($list1.items | Where-Object { $_.id -eq $id }).Count
  Write-Output ("FOUND_AFTER_CREATE=" + $found1)

  $draftPayload = @{
    draft = @{
      date = '31.03.2026'
      time = '13:12'
      employeeName = 'QA'
      meetingContent = 'Draft content'
      meetingFormat = 'Draft format'
      projects = @('Draft project', '')
      notificationsCount = '5'
      telegramSubscriptionsCount = '2'
      comment = 'Draft comment'
    }
  } | ConvertTo-Json -Depth 6

  $draftSave = Invoke-JsonRequest -Method 'Put' -Uri ($url + '/report-drafts/' + $id) -ContentType 'application/json' -Body $draftPayload
  Write-Output ("DRAFT_SAVE_SUCCESS=" + $draftSave.success)

  $reportsState1 = Invoke-JsonRequest -Method 'Get' -Uri ($url + '/reports')
  $draftExists = $null -ne $reportsState1.draftsByActivityId.$id
  Write-Output ("DRAFT_EXISTS_AFTER_SAVE=" + $draftExists)

  $updatedActivity = @{
    id = $id
    date = '31.03.2026'
    time = '13:15'
    name = 'UI check updated'
    person = 'QA'
    objects = 'Smoke'
    eventType = 'external'
  }

  $updatePayload = @{ activity = $updatedActivity } | ConvertTo-Json -Depth 6
  $update = Invoke-JsonRequest -Method 'Put' -Uri ($url + '/activities/' + $id) -ContentType 'application/json' -Body $updatePayload

  Write-Output ("UPDATE_SUCCESS=" + $update.success)

  $list2 = Invoke-JsonRequest -Method 'Get' -Uri ($url + '/activities')

  $row2 = $list2.items | Where-Object { $_.id -eq $id } | Select-Object -First 1
  Write-Output ("UPDATED_NAME=" + $row2.name)
  Write-Output ("UPDATED_EVENTTYPE=" + $row2.eventType)

  $reportPayload = @{
    report = @{
      date = '31.03.2026'
      time = '13:15'
      employeeName = 'QA'
      meetingContent = 'Final report'
      meetingFormat = 'Presentation'
      projects = @('Project Alpha', 'Project Beta')
      notificationsCount = '10'
      telegramSubscriptionsCount = '3'
      comment = 'Saved from smoke test'
    }
  } | ConvertTo-Json -Depth 6

  $reportSave = Invoke-JsonRequest -Method 'Put' -Uri ($url + '/reports/' + $id) -ContentType 'application/json' -Body $reportPayload
  Write-Output ("REPORT_SAVE_SUCCESS=" + $reportSave.success)

  $draftDelete = Invoke-JsonRequest -Method 'Delete' -Uri ($url + '/report-drafts/' + $id)
  Write-Output ("DRAFT_DELETE_SUCCESS=" + $draftDelete.success)

  $reportsState2 = Invoke-JsonRequest -Method 'Get' -Uri ($url + '/reports')
  $reportExists = $null -ne $reportsState2.reportsByActivityId.$id
  $draftExistsAfterDelete = $null -ne $reportsState2.draftsByActivityId.$id
  Write-Output ("REPORT_EXISTS_AFTER_SAVE=" + $reportExists)
  Write-Output ("DRAFT_EXISTS_AFTER_DELETE=" + $draftExistsAfterDelete)

  $delete = Invoke-JsonRequest -Method 'Delete' -Uri ($url + '/activities/' + $id)

  Write-Output ("DELETE_SUCCESS=" + $delete.success)

  $list3 = Invoke-JsonRequest -Method 'Get' -Uri ($url + '/activities')

  $found3 = @($list3.items | Where-Object { $_.id -eq $id }).Count
  Write-Output ("FOUND_AFTER_DELETE=" + $found3)

  if ($create.success -and $draftSave.success -and $draftExists -and $update.success -and $reportSave.success -and $draftDelete.success -and $reportExists -and -not $draftExistsAfterDelete -and $delete.success -and $found1 -ge 1 -and $found3 -eq 0) {
    Write-Output 'UI_FLOW_SMOKE: PASS'
    exit 0
  }

  Write-Output 'UI_FLOW_SMOKE: FAIL'
  exit 1
} catch {
  Write-Output ("UI_FLOW_SMOKE_ERROR: " + $_.Exception.Message)
  exit 1
}
