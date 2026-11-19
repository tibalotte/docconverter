#Requires -Version 5.1
<#
.SYNOPSIS
    Copie (ou déplace) le contenu des dossiers d'examen anonymisés EX01AM..EX25AM
    et EX01PM..EX25PM vers le dossier « Correction », en renommant chaque dossier
    au nom de l'élève choisi dans une liste Excel.

.DESCRIPTION
    Fonctionne sur la bibliothèque de fichiers de l'équipe Teams (SharePoint)
    synchronisée localement par OneDrive (bouton « Synchroniser » ou
    « Ajouter un raccourci à Mes fichiers » dans l'onglet Fichiers de Teams).
    OneDrive renvoie ensuite automatiquement les changements vers SharePoint.

    Lancer avec Lancer-CopierExamens.bat (double-clic).
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------------------
# Paramètres
# --------------------------------------------------------------------------
$MotifDossier = '^EX(0[1-9]|1[0-9]|2[0-5])(AM|PM)$'   # EX01AM..EX25AM, EX01PM..EX25PM
$NomDossierCorrection = 'Correction'
$Ignorer = '(ignorer)'
$ConfigDir = Join-Path $env:APPDATA 'CopierExamens'
$ConfigFile = Join-Path $ConfigDir 'config.json'

# --------------------------------------------------------------------------
# Utilitaires
# --------------------------------------------------------------------------
function Get-Config {
    if (Test-Path -LiteralPath $ConfigFile) {
        try { return Get-Content -LiteralPath $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
    }
    return [pscustomobject]@{ Source = ''; Correction = ''; Excel = '' }
}

function Save-Config($Source, $Correction, $Excel) {
    try {
        New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
        [pscustomobject]@{ Source = $Source; Correction = $Correction; Excel = $Excel } |
            ConvertTo-Json | Set-Content -LiteralPath $ConfigFile -Encoding UTF8
    } catch { }
}

function Remove-Accents([string]$s) {
    if (-not $s) { return '' }
    $d = $s.Trim().ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne 'NonSpacingMark') { [void]$sb.Append($ch) }
    }
    return $sb.ToString()
}

# Nom de dossier valide pour Windows / SharePoint
function Get-SafeName([string]$s) {
    $s = $s -replace '[\\/:*?"<>|]', ' '
    $s = ($s -replace '\s+', ' ').Trim().TrimEnd('.')
    return $s
}

function Show-Message($Text, $Icon = 'Information', $Buttons = 'OK') {
    return [System.Windows.Forms.MessageBox]::Show($Text, 'Copie des examens', $Buttons, $Icon)
}

# --------------------------------------------------------------------------
# Lecture de la liste d'élèves (Excel .xlsx/.xls ou .csv)
# Retourne un tableau de lignes, chaque ligne = tableau de chaînes.
# --------------------------------------------------------------------------
function Read-Rows([string]$Path) {
    $ext = [IO.Path]::GetExtension($Path).ToLowerInvariant()
    $rows = New-Object System.Collections.Generic.List[object]

    if ($ext -eq '.csv' -or $ext -eq '.txt') {
        $lines = @(Get-Content -LiteralPath $Path)   # détecte le BOM UTF-8, sinon ANSI
        if ($lines.Count -eq 0) { return ,@() }
        $delim = if ($lines[0] -match ';') { ';' } elseif ($lines[0] -match "`t") { "`t" } else { ',' }
        $nbCols = ($lines[0] -split [regex]::Escape($delim)).Count
        $headers = 1..([Math]::Max($nbCols, 1) + 5) | ForEach-Object { "c$_" }
        foreach ($r in ($lines | ConvertFrom-Csv -Delimiter $delim -Header $headers)) {
            $rows.Add([string[]]@($headers | ForEach-Object { [string]$r.$_ }))
        }
        return ,($rows.ToArray())
    }

    # Excel via automatisation COM (Excel doit être installé sur le poste)
    $xl = $null; $wb = $null; $ws = $null
    try {
        $xl = New-Object -ComObject Excel.Application
        $xl.Visible = $false
        $xl.DisplayAlerts = $false
        $wb = $xl.Workbooks.Open($Path, 0, $true)   # lecture seule
        $ws = $wb.Worksheets.Item(1)
        $val = $ws.UsedRange.Value2
        if ($null -eq $val) { return ,@() }
        if ($val -isnot [array]) { $rows.Add([string[]]@([string]$val)); return ,($rows.ToArray()) }
        $r0 = $val.GetLowerBound(0); $r1 = $val.GetUpperBound(0)
        $c0 = $val.GetLowerBound(1); $c1 = $val.GetUpperBound(1)
        for ($r = $r0; $r -le $r1; $r++) {
            $line = New-Object string[] ($c1 - $c0 + 1)
            for ($c = $c0; $c -le $c1; $c++) { $line[$c - $c0] = [string]$val[$r, $c] }
            $rows.Add($line)
        }
        return ,($rows.ToArray())
    }
    finally {
        if ($wb) { $wb.Close($false) }
        if ($xl) { $xl.Quit() }
        foreach ($o in @($ws, $wb, $xl)) { if ($o) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($o) } }
        [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    }
}

function Get-StudentList([string]$Path) {
    $rows = Read-Rows $Path      # tableau de lignes (non déroulé)
    if ($rows.Count -eq 0) { return @() }

    # Repérage des colonnes à partir de la 1re ligne (en-têtes)
    $head = @($rows[0] | ForEach-Object { Remove-Accents $_ })
    $iNom = -1; $iPrenom = -1; $iComplet = -1
    for ($i = 0; $i -lt $head.Count; $i++) {
        if ($iNom -lt 0 -and $head[$i] -match '^nom( de famille)?$') { $iNom = $i }
        elseif ($iPrenom -lt 0 -and $head[$i] -match '^prenom') { $iPrenom = $i }
        elseif ($iComplet -lt 0 -and $head[$i] -match '^(eleve|etudiant|etudiante|nom complet|nom et prenom|nom, prenom|nom prenom)s?$') { $iComplet = $i }
    }

    $hasHeader = ($iNom -ge 0 -or $iComplet -ge 0)
    $start = if ($hasHeader) { 1 } else { $iComplet = 0; 0 }

    $names = New-Object System.Collections.Generic.List[string]
    for ($ri = $start; $ri -lt $rows.Count; $ri++) {
        $r = $rows[$ri]
        if ($iNom -ge 0) {
            $n = ([string]$r[$iNom]).Trim()
            $p = if ($iPrenom -ge 0) { ([string]$r[$iPrenom]).Trim() } else { '' }
            $full = ("$n $p").Trim()
        } else {
            $full = ([string]$r[$iComplet]).Trim()
        }
        $full = ($full -replace '\s+', ' ')
        if ($full) { $names.Add($full) }
    }

    # Homonymes : on ajoute (2), (3)...
    $seen = @{}
    $result = foreach ($n in $names) {
        $k = $n.ToLowerInvariant()
        if ($seen.ContainsKey($k)) { $seen[$k]++; "$n ($($seen[$k]))" } else { $seen[$k] = 1; $n }
    }
    return @($result | Sort-Object -Culture 'fr-CA')
}

# --------------------------------------------------------------------------
# Recherche des dossiers EX
# --------------------------------------------------------------------------
function Get-ExamFolders([string]$Source) {
    $list = foreach ($d in (Get-ChildItem -LiteralPath $Source -Directory)) {
        if ($d.Name -match $MotifDossier) {
            $files = @(Get-ChildItem -LiteralPath $d.FullName -Recurse -File -ErrorAction SilentlyContinue)
            [pscustomobject]@{
                Code    = $d.Name.ToUpperInvariant()
                Path    = $d.FullName
                Num     = [int]$Matches[1]
                Periode = $Matches[2].ToUpperInvariant()
                Fichiers = $files.Count
            }
        }
    }
    return @($list | Sort-Object Periode, Num)
}

# --------------------------------------------------------------------------
# Interface
# --------------------------------------------------------------------------
$cfg = Get-Config
$students = @()
$exams = @()

$form = New-Object Windows.Forms.Form
$form.Text = 'Copie des examens vers « Correction »'
$form.Size = New-Object Drawing.Size(940, 700)
$form.MinimumSize = New-Object Drawing.Size(760, 500)
$form.StartPosition = 'CenterScreen'
$form.Font = New-Object Drawing.Font('Segoe UI', 9.5)

function New-PathRow([string]$Label, [int]$Y, [string]$Value) {
    $lbl = New-Object Windows.Forms.Label
    $lbl.Text = $Label; $lbl.Location = New-Object Drawing.Point(12, ($Y + 4)); $lbl.Size = New-Object Drawing.Size(190, 22)
    $txt = New-Object Windows.Forms.TextBox
    $txt.Location = New-Object Drawing.Point(205, $Y); $txt.Size = New-Object Drawing.Size(590, 24)
    $txt.Anchor = 'Top,Left,Right'; $txt.Text = $Value
    $btn = New-Object Windows.Forms.Button
    $btn.Text = 'Parcourir…'; $btn.Location = New-Object Drawing.Point(805, ($Y - 1)); $btn.Size = New-Object Drawing.Size(105, 27)
    $btn.Anchor = 'Top,Right'
    $form.Controls.AddRange(@($lbl, $txt, $btn))
    return @{ Text = $txt; Button = $btn }
}

$rowSrc = New-PathRow 'Dossier des examens (EX…) :' 12 $cfg.Source
$rowCor = New-PathRow 'Dossier « Correction » :' 44 $cfg.Correction
$rowXls = New-PathRow 'Liste des élèves (Excel) :' 76 $cfg.Excel

function Select-Folder($TextBox, $Description) {
    $dlg = New-Object Windows.Forms.FolderBrowserDialog
    $dlg.Description = $Description
    if ($TextBox.Text -and (Test-Path -LiteralPath $TextBox.Text)) { $dlg.SelectedPath = $TextBox.Text }
    if ($dlg.ShowDialog($form) -eq 'OK') { $TextBox.Text = $dlg.SelectedPath; return $true }
    return $false
}

$rowSrc.Button.Add_Click({
    if (Select-Folder $rowSrc.Text 'Choisir le dossier (synchronisé de Teams) qui contient EX01AM, EX02AM…') {
        $guess = Join-Path $rowSrc.Text.Text $NomDossierCorrection
        if (-not $rowCor.Text.Text -and (Test-Path -LiteralPath $guess)) { $rowCor.Text.Text = $guess }
        Load-Exams
    }
})
$rowCor.Button.Add_Click({ [void](Select-Folder $rowCor.Text 'Choisir le dossier « Correction »') })
$rowXls.Button.Add_Click({
    $dlg = New-Object Windows.Forms.OpenFileDialog
    $dlg.Filter = 'Liste Excel ou CSV|*.xlsx;*.xlsm;*.xls;*.csv|Tous les fichiers|*.*'
    if ($dlg.ShowDialog($form) -eq 'OK') { $rowXls.Text.Text = $dlg.FileName; Load-Students }
})

$btnLoad = New-Object Windows.Forms.Button
$btnLoad.Text = 'Charger / actualiser'; $btnLoad.Location = New-Object Drawing.Point(205, 108); $btnLoad.Size = New-Object Drawing.Size(170, 30)
$chkEmpty = New-Object Windows.Forms.CheckBox
$chkEmpty.Text = 'Masquer les dossiers vides'; $chkEmpty.Checked = $true
$chkEmpty.Location = New-Object Drawing.Point(395, 112); $chkEmpty.Size = New-Object Drawing.Size(220, 24)
$form.Controls.AddRange(@($btnLoad, $chkEmpty))

$lblHelp = New-Object Windows.Forms.Label
$lblHelp.Text = 'Pour chaque code d''examen, choisir l''élève correspondant (taper les premières lettres pour chercher).'
$lblHelp.Location = New-Object Drawing.Point(12, 146); $lblHelp.Size = New-Object Drawing.Size(900, 22); $lblHelp.Anchor = 'Top,Left,Right'
$form.Controls.Add($lblHelp)

# Grille
$grid = New-Object Windows.Forms.DataGridView
$grid.Location = New-Object Drawing.Point(12, 170)
$grid.Size = New-Object Drawing.Size(898, 410)
$grid.Anchor = 'Top,Bottom,Left,Right'
$grid.AllowUserToAddRows = $false
$grid.AllowUserToDeleteRows = $false
$grid.AllowUserToResizeRows = $false
$grid.RowHeadersVisible = $false
$grid.EditMode = 'EditOnEnter'
$grid.SelectionMode = 'CellSelect'
$grid.MultiSelect = $false
$grid.BackgroundColor = [Drawing.SystemColors]::Window
$grid.RowTemplate.Height = 28

$colCode = New-Object Windows.Forms.DataGridViewTextBoxColumn
$colCode.HeaderText = 'Code d''examen'; $colCode.ReadOnly = $true; $colCode.Width = 130
$colFiles = New-Object Windows.Forms.DataGridViewTextBoxColumn
$colFiles.HeaderText = 'Fichiers'; $colFiles.ReadOnly = $true; $colFiles.Width = 75
$colEleve = New-Object Windows.Forms.DataGridViewComboBoxColumn
$colEleve.HeaderText = 'Élève'; $colEleve.AutoSizeMode = 'Fill'; $colEleve.FlatStyle = 'Flat'
$colEleve.DisplayStyle = 'DropDownButton'
$colStatut = New-Object Windows.Forms.DataGridViewTextBoxColumn
$colStatut.HeaderText = 'Statut'; $colStatut.ReadOnly = $true; $colStatut.Width = 230
[void]$grid.Columns.AddRange(@($colCode, $colFiles, $colEleve, $colStatut))
$form.Controls.Add($grid)
$C_CODE = 0; $C_FILES = 1; $C_ELEVE = 2; $C_STATUT = 3

# Liste déroulante avec recherche par saisie
$grid.Add_EditingControlShowing({
    param($s, $e)
    if ($e.Control -is [Windows.Forms.ComboBox]) {
        $cb = $e.Control
        $cb.DropDownStyle = 'DropDown'
        $cb.AutoCompleteSource = 'ListItems'
        $cb.AutoCompleteMode = 'SuggestAppend'
    }
})
$grid.Add_CellValidating({
    param($s, $e)
    if ($e.ColumnIndex -ne $C_ELEVE) { return }
    $txt = [string]$e.FormattedValue
    if (-not $txt) { $grid.Rows[$e.RowIndex].Cells[$C_ELEVE].Value = $Ignorer; return }
    $match = $null
    foreach ($it in $colEleve.Items) { if ([string]$it -ieq $txt) { $match = [string]$it; break } }
    if ($match) {
        $grid.Rows[$e.RowIndex].Cells[$C_ELEVE].Value = $match
    } else {
        [void](Show-Message "« $txt » ne figure pas dans la liste des élèves." 'Warning')
        $e.Cancel = $true
    }
})
$grid.Add_DataError({ param($s, $e) $e.ThrowException = $false })
$grid.Add_CellValueChanged({ param($s, $e) if ($e.RowIndex -ge 0 -and $e.ColumnIndex -eq $C_ELEVE) { Update-Duplicates } })

# Bas de fenêtre
$chkMove = New-Object Windows.Forms.CheckBox
$chkMove.Text = 'Déplacer : vider les dossiers EX après une copie vérifiée'
$chkMove.Location = New-Object Drawing.Point(12, 592); $chkMove.Size = New-Object Drawing.Size(450, 24); $chkMove.Anchor = 'Bottom,Left'
$btnRun = New-Object Windows.Forms.Button
$btnRun.Text = 'Lancer la copie'; $btnRun.Location = New-Object Drawing.Point(660, 588); $btnRun.Size = New-Object Drawing.Size(140, 34)
$btnRun.Anchor = 'Bottom,Right'; $btnRun.Font = New-Object Drawing.Font('Segoe UI', 9.5, [Drawing.FontStyle]::Bold)
$btnClose = New-Object Windows.Forms.Button
$btnClose.Text = 'Fermer'; $btnClose.Location = New-Object Drawing.Point(810, 588); $btnClose.Size = New-Object Drawing.Size(100, 34)
$btnClose.Anchor = 'Bottom,Right'
$status = New-Object Windows.Forms.StatusStrip
$statusLbl = New-Object Windows.Forms.ToolStripStatusLabel
$statusLbl.Text = 'Prêt.'
[void]$status.Items.Add($statusLbl)
$form.Controls.AddRange(@($chkMove, $btnRun, $btnClose, $status))

$btnClose.Add_Click({ $form.Close() })

# --------------------------------------------------------------------------
# Logique
# --------------------------------------------------------------------------
function Update-Duplicates {
    $count = @{}
    foreach ($row in $grid.Rows) {
        $v = [string]$row.Cells[$C_ELEVE].Value
        if ($v -and $v -ne $Ignorer) { $count[$v] = 1 + [int]$count[$v] }
    }
    foreach ($row in $grid.Rows) {
        $v = [string]$row.Cells[$C_ELEVE].Value
        $cell = $row.Cells[$C_STATUT]
        if ($v -and $v -ne $Ignorer -and $count[$v] -gt 1) {
            $cell.Value = 'Élève choisi plus d''une fois !'; $cell.Style.ForeColor = [Drawing.Color]::Firebrick
        } elseif ($cell.Value -eq 'Élève choisi plus d''une fois !') {
            $cell.Value = ''; $cell.Style.ForeColor = [Drawing.Color]::Empty
        }
    }
}

function Load-Students {
    $path = $rowXls.Text.Text.Trim()
    if (-not $path) { return }
    if (-not (Test-Path -LiteralPath $path)) { [void](Show-Message "Fichier introuvable :`n$path" 'Warning'); return }
    $form.Cursor = 'WaitCursor'; $statusLbl.Text = 'Lecture de la liste des élèves…'; $form.Refresh()
    try {
        $script:students = @(Get-StudentList $path)
    } catch {
        [void](Show-Message "Impossible de lire la liste d'élèves.`n`n$($_.Exception.Message)`n`nAstuce : enregistrer la liste en CSV (Fichier > Enregistrer sous > CSV) et choisir ce fichier." 'Error')
        $script:students = @()
    } finally { $form.Cursor = 'Default' }
    Fill-Grid
}

function Load-Exams {
    $src = $rowSrc.Text.Text.Trim()
    if (-not $src) { return }
    if (-not (Test-Path -LiteralPath $src)) { [void](Show-Message "Dossier introuvable :`n$src" 'Warning'); return }
    $form.Cursor = 'WaitCursor'; $statusLbl.Text = 'Recherche des dossiers EX…'; $form.Refresh()
    try { $script:exams = @(Get-ExamFolders $src) } finally { $form.Cursor = 'Default' }
    Fill-Grid
}

function Fill-Grid {
    # Conserver les choix déjà faits
    $previous = @{}
    foreach ($row in $grid.Rows) { $previous[[string]$row.Cells[$C_CODE].Value] = [string]$row.Cells[$C_ELEVE].Value }

    $grid.Rows.Clear()
    $colEleve.Items.Clear()
    [void]$colEleve.Items.Add($Ignorer)
    if ($script:students.Count -gt 0) { $colEleve.Items.AddRange([object[]]$script:students) }

    $shown = 0
    foreach ($ex in $script:exams) {
        if ($chkEmpty.Checked -and $ex.Fichiers -eq 0) { continue }
        $val = $Ignorer
        if ($previous.ContainsKey($ex.Code) -and $colEleve.Items.Contains($previous[$ex.Code])) { $val = $previous[$ex.Code] }
        $i = $grid.Rows.Add($ex.Code, $ex.Fichiers, $val, '')
        $grid.Rows[$i].Tag = $ex
        $shown++
    }
    Update-Duplicates
    $statusLbl.Text = "$shown dossier(s) d'examen affiché(s) sur $($script:exams.Count) trouvé(s) · $($script:students.Count) élève(s) dans la liste."
}

$btnLoad.Add_Click({ Load-Students; Load-Exams })
$chkEmpty.Add_CheckedChanged({ Fill-Grid })

$btnRun.Add_Click({
    [void]$grid.EndEdit()
    $src = $rowSrc.Text.Text.Trim()
    $cor = $rowCor.Text.Text.Trim()

    if (-not $src -or -not (Test-Path -LiteralPath $src)) { [void](Show-Message 'Choisir le dossier des examens.' 'Warning'); return }
    if (-not $cor) { [void](Show-Message 'Choisir le dossier « Correction ».' 'Warning'); return }
    if (-not (Test-Path -LiteralPath $cor)) {
        if ((Show-Message "Le dossier « Correction » n'existe pas :`n$cor`n`nLe créer ?" 'Question' 'YesNo') -ne 'Yes') { return }
        New-Item -ItemType Directory -Force -Path $cor | Out-Null
    }

    # Lignes à traiter
    $todo = @()
    $seen = @{}
    foreach ($row in $grid.Rows) {
        $eleve = [string]$row.Cells[$C_ELEVE].Value
        if (-not $eleve -or $eleve -eq $Ignorer) { continue }
        if ($seen.ContainsKey($eleve)) {
            [void](Show-Message "L'élève « $eleve » est associé(e) à $($seen[$eleve]) et à $($row.Cells[$C_CODE].Value).`nCorriger avant de continuer." 'Warning')
            return
        }
        $seen[$eleve] = $row.Cells[$C_CODE].Value
        $todo += $row
    }
    if ($todo.Count -eq 0) { [void](Show-Message 'Aucun élève n''a été associé à un code d''examen.' 'Warning'); return }

    # Confirmation
    $mode = if ($chkMove.Checked) { 'DÉPLACER' } else { 'COPIER' }
    $lines = ($todo | ForEach-Object { "   $($_.Cells[$C_CODE].Value)  →  $($_.Cells[$C_ELEVE].Value)" }) -join "`n"
    $msg = "Confirmer les correspondances suivantes ($mode vers « $(Split-Path $cor -Leaf) ») :`n`n$lines"
    if ($chkMove.Checked) { $msg += "`n`nATTENTION : le contenu des dossiers EX sera supprimé après la copie vérifiée." }
    if ((Show-Message $msg 'Question' 'YesNo') -ne 'Yes') { return }

    $btnRun.Enabled = $false; $form.Cursor = 'WaitCursor'
    $journal = New-Object System.Collections.Generic.List[object]
    $ok = 0; $err = 0
    try {
        foreach ($row in $todo) {
            $ex = $row.Tag
            $eleve = [string]$row.Cells[$C_ELEVE].Value
            $cell = $row.Cells[$C_STATUT]
            $cell.Value = 'Copie en cours…'; $cell.Style.ForeColor = [Drawing.Color]::Empty
            $statusLbl.Text = "$($ex.Code) → $eleve"
            [Windows.Forms.Application]::DoEvents()
            $etat = ''
            $dest = ''
            try {
                $nomDossier = Get-SafeName $eleve
                if (-not $nomDossier) { throw 'Nom d''élève invalide.' }
                $dest = Join-Path $cor $nomDossier
                if (Test-Path -LiteralPath $dest) { $dest = Join-Path $cor "$nomDossier - $($ex.Code)" }
                if (Test-Path -LiteralPath $dest) { throw "Le dossier existe déjà : $(Split-Path $dest -Leaf)" }

                New-Item -ItemType Directory -Path $dest | Out-Null
                Get-ChildItem -LiteralPath $ex.Path -Force | Copy-Item -Destination $dest -Recurse -Force

                $nSrc = @(Get-ChildItem -LiteralPath $ex.Path -Recurse -File -ErrorAction SilentlyContinue).Count
                $nDst = @(Get-ChildItem -LiteralPath $dest -Recurse -File -ErrorAction SilentlyContinue).Count
                if ($nDst -lt $nSrc) { throw "Vérification échouée ($nDst/$nSrc fichiers copiés)." }

                if ($chkMove.Checked) {
                    Get-ChildItem -LiteralPath $ex.Path -Force | Remove-Item -Recurse -Force
                    $etat = "Déplacé ($nDst fichier(s))"
                } else {
                    $etat = "Copié ($nDst fichier(s))"
                }
                $cell.Value = "✔ $etat → $(Split-Path $dest -Leaf)"; $cell.Style.ForeColor = [Drawing.Color]::DarkGreen
                $ok++
            } catch {
                $etat = "ERREUR : $($_.Exception.Message)"
                $cell.Value = "✖ $etat"; $cell.Style.ForeColor = [Drawing.Color]::Firebrick
                $err++
            }
            $journal.Add([pscustomobject]@{
                Date = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
                CodeExamen = $ex.Code
                Eleve = $eleve
                DossierDestination = $dest
                Resultat = $etat
                Utilisateur = $env:USERNAME
            })
            [Windows.Forms.Application]::DoEvents()
        }
    } finally {
        $btnRun.Enabled = $true; $form.Cursor = 'Default'
    }

    # Journal des correspondances (CSV, s'ouvre dans Excel)
    $journalPath = Join-Path $cor ("_journal_copie_{0}.csv" -f (Get-Date -Format 'yyyy-MM-dd_HHmmss'))
    try { $journal | Export-Csv -LiteralPath $journalPath -Delimiter ';' -Encoding UTF8 -NoTypeInformation } catch { $journalPath = '(journal non enregistré)' }

    Save-Config $src $cor $rowXls.Text.Text.Trim()
    $statusLbl.Text = "Terminé : $ok réussi(s), $err erreur(s)."
    $icon = if ($err -gt 0) { 'Warning' } else { 'Information' }
    [void](Show-Message "Terminé : $ok dossier(s) traité(s), $err erreur(s).`n`nJournal : $journalPath" $icon)

    # Rafraîchir le nombre de fichiers sans perdre l'affichage des statuts
    if ($chkMove.Checked) { foreach ($row in $todo) { if ($row.Cells[$C_STATUT].Value -like '✔*') { $row.Cells[$C_FILES].Value = 0 } } }
})

$form.Add_FormClosing({ Save-Config $rowSrc.Text.Text.Trim() $rowCor.Text.Text.Trim() $rowXls.Text.Text.Trim() })
$form.Add_Shown({
    if ($rowXls.Text.Text) { Load-Students }
    if ($rowSrc.Text.Text) { Load-Exams }
    if (-not $rowSrc.Text.Text) { $statusLbl.Text = 'Commencer par choisir le dossier des examens, le dossier Correction et la liste des élèves.' }
})

[void]$form.ShowDialog()
