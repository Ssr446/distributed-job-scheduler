$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open("C:\Users\ssrsh\Documents\projects\codity\Distributed_Job_Scheduler_Assignment.docx")
$text = $doc.Content.Text
Write-Output $text
$doc.Close()
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
