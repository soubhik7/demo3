# /add-download-type

Add a new downloadable output file type — wire it end-to-end:
Python output → C# download endpoint → result.html download button.

## What to ask the user first
- File type key (short string used in the URL, e.g. `pdf`, `zip`, `report`)
- Filename (e.g. `summary.pdf`, `output.zip`)
- MIME type
- Which Python script produces this file?
- Button label shown on the result page (e.g. `⬇ Summary PDF`)
- Button colour class: `dl-yaml` | `dl-xlsx` | `dl-csv` | `dl-log` | (or define new)

## Step 1 — C# controller (OnboardingController.cs)

Add the new type to the `allowed` dictionary inside `Download()`:

```csharp
["<type-key>"] = ("<filename.ext>", "<mime/type>"),
```

## Step 2 — result.html (wwwroot/result.html)

Add an entry to the `map` object inside `buildDownloadButtons()` in `app.js`:

```js
'<filename.ext>': { type: '<type-key>', label: '<Button Label>', cls: 'dl-<class>' },
```

If you need a new colour class, add it to `style.css`:

```css
.dl-<class> { color: #<text>; border-color: #<border>; background: #<bg>; }
```

## Step 3 — Python script

Make sure the script writes the file to the path provided by `--out-<type>` argument
(or the C# controller moves it into the `outputs/{runId}/` directory after the run).

### Option A — script writes to explicit path (preferred)

```python
parser.add_argument("--out-<type>", default=None, help="Output path for <file>")
# ...
out_path = Path(args.out_<type>) if args.out_<type> else outputs_dir / f"<filename>.ext"
write_<type>(rows, str(out_path))
```

Update `PythonRunner.Run<ScriptName>()` to pass the argument:

```csharp
var out<Type> = Path.Combine(outputDir, "<filename.ext>");
var args = $"... --out-<type> \"{out<Type>}\"";
```

### Option B — script writes to fixed path, C# moves it

```csharp
// After RunProcess, move file into the run dir
var src = Path.Combine(rootOutputs, $"{countryKey}_<filename>.ext");
var dst = Path.Combine(outputDir, "<filename.ext>");
if (File.Exists(src) && !File.Exists(dst))
    File.Move(src, dst);
```

## Step 4 — Return in API response

In the `Run()` / `Orchestrate()` controller method, add the new filename to the `files` array:

```csharp
files = new[] { "patched.yaml", "translations.xlsx", "translations.csv", "<filename.ext>" }
```

## Checklist
- [ ] `allowed` dict in `Download()` updated
- [ ] `map` object in `buildDownloadButtons()` (app.js) updated
- [ ] CSS colour class added to `style.css` (if new)
- [ ] Python script writes the file to the controlled path
- [ ] `PythonRunner` passes `--out-<type>` argument
- [ ] Filename included in the API response `files` array
