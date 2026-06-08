$DataFile = Join-Path (Get-Location) "data.json"

# Initialize multi-user data file if it doesn't exist
if (-not (Test-Path $DataFile)) {
    $DefaultData = @{
        users = @()
    }
    $DefaultData | ConvertTo-Json -Depth 10 | Out-File $DataFile -Encoding utf8
}

function Get-Store {
    return Get-Content $DataFile -Raw | ConvertFrom-Json
}

function Save-Store($Store) {
    $Store | ConvertTo-Json -Depth 10 | Out-File $DataFile -Encoding utf8
}

function Get-Hash($String) {
    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($String)
    $Hasher = [System.Security.Cryptography.SHA256]::Create()
    $HashBytes = $Hasher.ComputeHash($Bytes)
    return [System.BitConverter]::ToString($HashBytes).Replace("-", "").ToLower()
}

$HttpListener = [System.Net.HttpListener]::new()
$HttpListener.Prefixes.Add("http://localhost:8000/")
$HttpListener.Start()
Write-Host "🚀 Multi-User Server running at http://localhost:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

try {
    while ($true) {
        $Context = $HttpListener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response
        
        $Path = $Request.Url.LocalPath
        $UserEmail = $Request.Headers["X-User-Email"]
        
        if ($Path.StartsWith("/api/")) {
            $Response.ContentType = "application/json; charset=utf-8"
            $Endpoint = $Path.Substring(5)
            
            $Reader = [System.IO.StreamReader]::new($Request.InputStream)
            $Body = $Reader.ReadToEnd()
            $Json = if ($Body) { $Body | ConvertFrom-Json } else { $null }
            $Store = Get-Store

            if ($Endpoint -eq "register") {
                if ($Store.users | Where-Object { $_.email -eq $Json.email }) {
                    $Response.StatusCode = 400
                    $Bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Email already registered"}')
                } else {
                    $NewUser = @{
                        email = $Json.email
                        password = Get-Hash $Json.password
                        businessName = $Json.businessName
                        data = @{ sales = @(); expenses = @(); stock = @(); profile = @{ businessName = $Json.businessName } }
                    }
                    $Store.users += $NewUser
                    Save-Store $Store
                    $Bytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok"}')
                }
                $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
            }
            elseif ($Endpoint -eq "login") {
                $Hashed = Get-Hash $Json.password
                $User = $Store.users | Where-Object { $_.email -eq $Json.email -and $_.password -eq $Hashed }
                if ($User) {
                    $Bytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok", "businessName":"' + $User.businessName + '"}')
                } else {
                    $Response.StatusCode = 401
                    $Bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Invalid credentials"}')
                }
                $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
            }
            else {
                # Protected Endpoints
                if (-not $UserEmail) {
                    $Response.StatusCode = 401
                    $Response.Close(); continue
                }
                
                $UserIndex = -1
                for($i=0; $i -lt $Store.users.Count; $i++) {
                    if($Store.users[$i].email -eq $UserEmail) { $UserIndex = $i; break }
                }

                if ($UserIndex -eq -1) {
                    $Response.StatusCode = 401
                    $Response.Close(); continue
                }

                if ($Request.HttpMethod -eq "GET") {
                    if ($Endpoint -eq "data") {
                        $Output = $Store.users[$UserIndex].data
                        $Bytes = [System.Text.Encoding]::UTF8.GetBytes(($Output | ConvertTo-Json -Depth 10))
                        $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
                    }
                    elseif ($Endpoint -eq "profile") {
                        $Bytes = [System.Text.Encoding]::UTF8.GetBytes(($Store.users[$UserIndex].data.profile | ConvertTo-Json -Depth 10))
                        $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
                    }
                }
                elseif ($Request.HttpMethod -eq "POST") {
                    switch ($Endpoint) {
                        "sales"    { $Store.users[$UserIndex].data.sales += $Json }
                        "expenses" { $Store.users[$UserIndex].data.expenses += $Json }
                        "stock"    { $Store.users[$UserIndex].data.stock += $Json }
                        "profile"  { $Store.users[$UserIndex].data.profile = $Json }
                    }
                    Save-Store $Store
                    $Bytes = [System.Text.Encoding]::UTF8.GetBytes('{"status":"ok"}')
                    $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
                }
            }
        }
        else {
            # Static File Handling
            if ($Path -eq "/") { $Path = "/index.html" }
            $FilePath = Join-Path (Get-Location) ("." + $Path)
            if (Test-Path $FilePath -PathType Leaf) {
                $FileContent = [System.IO.File]::ReadAllBytes($FilePath)
                $Response.ContentLength64 = $FileContent.Length
                $ext = [System.IO.Path]::GetExtension($FilePath)
                $Response.ContentType = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".js" { "application/javascript; charset=utf-8" }
                    ".css" { "text/css; charset=utf-8" }
                    default { "application/octet-stream" }
                }
                $Response.OutputStream.Write($FileContent, 0, $FileContent.Length)
            } else {
                $Response.StatusCode = 404
            }
        }
        $Response.Close()
    }
} finally {
    $HttpListener.Stop()
    $HttpListener.Close()
}
