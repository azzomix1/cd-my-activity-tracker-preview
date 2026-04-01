$ErrorActionPreference = 'Stop'

try {
  $line = Get-Content .env.local | Select-Object -First 1
  $url = $line -replace '^VITE_SHEETS_API_URL=', ''
  Write-Output ("URL=" + $url)

  $id = 'ui-check-' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

  $createPayload = @{
    action = 'create'
    activity = @{
      id = $id
      date = '31.03.2026'
      time = '13:10'
      name = 'UI check create'
      person = 'QA'
      objects = 'Smoke'
      eventType = 'internal'
    }
  } | ConvertTo-Json -Depth 6

  $create = Invoke-RestMethod -Method Post -Uri $url -ContentType 'text/plain;charset=utf-8' -Body $createPayload -MaximumRedirection 5
  Write-Output ("CREATE_SUCCESS=" + $create.success)

  $list1 = Invoke-RestMethod -Method Get -Uri ($url + '?action=list') -MaximumRedirection 5
  $found1 = @($list1.items | Where-Object { $_.id -eq $id }).Count
  Write-Output ("FOUND_AFTER_CREATE=" + $found1)

  $updatePayload = @{
    action = 'update'
    activity = @{
      id = $id
      date = '31.03.2026'
      time = '13:15'
      name = 'UI check updated'
      person = 'QA'
      objects = 'Smoke'
      eventType = 'external'
    }
  } | ConvertTo-Json -Depth 6

  $update = Invoke-RestMethod -Method Post -Uri $url -ContentType 'text/plain;charset=utf-8' -Body $updatePayload -MaximumRedirection 5
  Write-Output ("UPDATE_SUCCESS=" + $update.success)

  $list2 = Invoke-RestMethod -Method Get -Uri ($url + '?action=list') -MaximumRedirection 5
  $row2 = $list2.items | Where-Object { $_.id -eq $id } | Select-Object -First 1
  Write-Output ("UPDATED_NAME=" + $row2.name)
  Write-Output ("UPDATED_EVENTTYPE=" + $row2.eventType)

  $deletePayload = @{
    action = 'delete'
    id = $id
  } | ConvertTo-Json -Depth 4

  $delete = Invoke-RestMethod -Method Post -Uri $url -ContentType 'text/plain;charset=utf-8' -Body $deletePayload -MaximumRedirection 5
  Write-Output ("DELETE_SUCCESS=" + $delete.success)

  $list3 = Invoke-RestMethod -Method Get -Uri ($url + '?action=list') -MaximumRedirection 5
  $found3 = @($list3.items | Where-Object { $_.id -eq $id }).Count
  Write-Output ("FOUND_AFTER_DELETE=" + $found3)

  if ($create.success -and $update.success -and $delete.success -and $found1 -ge 1 -and $found3 -eq 0) {
    Write-Output 'UI_FLOW_SMOKE: PASS'
    exit 0
  }

  Write-Output 'UI_FLOW_SMOKE: FAIL'
  exit 1
} catch {
  Write-Output ("UI_FLOW_SMOKE_ERROR: " + $_.Exception.Message)
  exit 1
}
