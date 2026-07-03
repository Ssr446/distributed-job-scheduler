Add-Type -AssemblyName System.IO.Compression.FileSystem

$docxPath = "C:\Users\ssrsh\Documents\projects\codity\Distributed_Job_Scheduler_Assignment.docx"
$outputPath = "C:\Users\ssrsh\Documents\projects\codity\assignment.txt"

$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.GetEntry("word/document.xml")
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = [xml]$reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()

$nsMgr = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$nsMgr.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

$paragraphs = $xml.SelectNodes("//w:p", $nsMgr)
$text = ""
foreach ($para in $paragraphs) {
    $runs = $para.SelectNodes(".//w:t", $nsMgr)
    $line = ""
    foreach ($run in $runs) {
        $line += $run.InnerText
    }
    $text += $line + "`r`n"
}

$text | Out-File -FilePath $outputPath -Encoding UTF8
Write-Host "Done! Text extracted to $outputPath"
