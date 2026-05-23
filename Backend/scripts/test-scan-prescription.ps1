param(
  [Parameter(Mandatory = $true)]
  [string]$FilePath,

  [Parameter(Mandatory = $true)]
  [string]$FamilyMemberId,

  [Parameter(Mandatory = $true)]
  [string]$BearerToken,

  [string]$ApiBaseUrl = "http://localhost:4000"
)

if (!(Test-Path -LiteralPath $FilePath)) {
  throw "File not found: $FilePath"
}

$uri = "$ApiBaseUrl/api/scan-prescription"

curl.exe `
  -X POST $uri `
  -H "Authorization: Bearer $BearerToken" `
  -F "family_member_id=$FamilyMemberId" `
  -F "image=@$FilePath"
