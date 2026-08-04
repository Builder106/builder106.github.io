# Multi-Resume Kit

A LaTeX system for maintaining several role-targeted resumes, each in three
presentation variants, without the content drifting out of sync between
copies.

**Live preview:** <https://yinkavaughan.me/multi-resume-kit/>

## The problem

If you're applying to more than one kind of role, say a software engineering
track and a data/analyst track, you end up with more than one resume. Each of
those resumes usually needs more than one presentation, too: a version with
clickable links and color for PDF viewing, a version safe to print in black
and white, and a plain version stripped down for an ATS parser that chokes on
icons and hyperlinks.

Multiply roles by variants and you get a lot of `.tex` files that all share
the same Education section, the same certification links, and often the same
one or two Experience entries. Every one of those needs to be edited in
lockstep whenever a school, a cert, or a job ends. Miss one file and now your
resumes disagree with each other.

This kit is the pattern that fixes that, extracted from a real resume set I
maintain across several roles and genericized so it's safe to publish (see
[Content](#content) below).

## The shared-asset pattern

`template/assets/` holds three files, each a set of `\newcommand` macros:

- **`education-common.tex`**: the school/degree line, an Organizations line,
  and Honors/Awards in both a hyperlinked (digital) and plain-text
  (physical/ats) form.
- **`certs.tex`**: certification URLs as named macros (`\exampleCertLinkOne`),
  so a cert re-upload only means editing one line.
- **`experience-bank.tex`**: full Experience entries (subheading plus
  bullets), again in both linked and plain forms.

Every resume file pulls these in with `\input{}` and calls the macros instead
of retyping the content:

```latex
\input{../../../assets/education-common.tex}
...
\exampleEducation
\honorsAwardsLinked
```

One edit to `assets/education-common.tex` propagates to every role and every
variant that references it. No find-and-replace across a dozen files.

## The three-variant convention

| Variant | hyperref mode | Header | Project names |
| --- | --- | --- | --- |
| **digital** | `colorlinks` | icon row (phone, mail, LinkedIn, GitHub, site) | `\projectTitle{slug}{Name}`, bold and clickable |
| **physical** | `hidelinks` | two-column: contact left, QR codes right | plain `\textbf{}`, nothing to click on paper |
| **ats** | `hidelinks` | plain text line | plain `\textbf{}` |

Same content, three presentations. `template/Roles/Example/{digital,
physical,ats}/` shows all three built from the same shared assets, so you can
diff them directly to see exactly what changes between variants and what
doesn't.

## The rule that keeps them honest

**Content parity**: within one role, Experience and Projects bullet wording
and numbers must be identical across all three variants; only the
presentation macros differ. If you edit a bullet in the digital version,
apply the same edit to physical and ats in the same pass, then recompile all
three. This is the rule that actually prevents drift. The shared-asset
pattern above just makes it easier to follow.

## Two LaTeX gotchas this kit avoids

Both of these are easy to introduce by accident, and both compile cleanly.
Neither throws an error, so they only show up as a wrong-looking PDF.

**1. `\newcommand` "lengths" don't support arithmetic.**

```latex
\newcommand{\myGap}{11pt}   % looks like a length, isn't one
\vspace{2\myGap}            % NOT 22pt, this string-concatenates to 211pt
```

`\newcommand` defines a text macro. `2\myGap` expands `\myGap` to the literal
text `11pt` and prepends `2`, producing the dimension `211pt` (nearly 3
inches), not the `22pt` you meant. If you need a spacing unit that gets
multiplied by a variable coefficient anywhere, define it as a real length
instead:

```latex
\newlength{\myGap}
\setlength{\myGap}{11pt}
\vspace{2\myGap}            % correctly 22pt
```

**2. A shell auto-clean wrapper doesn't apply in non-interactive shells.**

If you've wrapped `pdflatex` in a shell function that deletes `.aux`/`.log`/
`.out` after each run, that wrapper only loads in an *interactive* shell. It
never sources in CI, in a Docker build step, or in any tool that spawns a
non-interactive shell. Byproducts pile up silently in those contexts. Sweep
explicitly instead of assuming the wrapper handled it:

```sh
find . \( -name "*.aux" -o -name "*.log" -o -name "*.out" \) -delete
```

## Page-count discipline

After any edit, check every variant of every role, not just the one you
touched. A shared-asset edit that adds two lines to Education can push an
already-tight resume onto a second page elsewhere:

```sh
find . -name "*.tex" -print0 | while IFS= read -r -d '' f; do
  dir=$(dirname "$f"); base=$(basename "$f" .tex)
  (cd "$dir" && pdflatex -interaction=nonstopmode "$base.tex" >/dev/null 2>&1
   pdflatex -interaction=nonstopmode "$base.tex" >/dev/null 2>&1
   echo "$f: $(pdfinfo "$base.pdf" 2>/dev/null | grep Pages)")
done
```

A resume that reads 1 page before your edit and 2 pages after almost always
means a spacing constant needs tightening, not that content needs cutting.
Check the spacing-constant block at the top of each `.tex` file
(`\spaceAfterList`, `\spaceAroundRule`, and so on) before reaching for the
delete key.

## How to adapt this for your own resumes

1. Fork `template/` into your own project.
2. Find-and-replace the placeholder identity (`Jordan Doe`, `jordan.doe@example.com`,
   `github.com/jordan-doe`, etc.) with your own.
3. Edit `assets/education-common.tex`, `assets/certs.tex`, and
   `assets/experience-bank.tex` with your real school, certs, and any
   Experience entries that repeat across roles.
4. Copy `Roles/Example/` to `Roles/<YourRole>/` for each role you're
   targeting, and write role-specific Projects content in each variant.
   Projects are the one section this kit doesn't share, since they're
   naturally different per role.
5. Regenerate your own QR codes (`qrencode -o qr_x.png -s 10 "https://..."`)
   pointing at your real profiles. Never reuse placeholder ones in a real
   resume, and never reuse real ones in a published example.
6. Run the page-count sweep above after every edit, across every role and
   variant, not just the one you changed.

## Content

Everything under `template/`, including the name, contact info, school,
certifications, employer, projects, and bullet content, is fictitious. It
exists only to demonstrate the pattern's structure and is not a claim of real
work or credentials.

## Building the examples

The three example resumes need a LaTeX toolchain (`pdflatex`) to compile.
This repo doesn't wire that into the portfolio's own build, since it's a
one-time step rather than something that needs to run on every push:

```sh
cd template/Roles/Example/<variant>
pdflatex -interaction=nonstopmode <file>.tex
pdflatex -interaction=nonstopmode <file>.tex   # second pass resolves references
```

The compiled PDFs and preview screenshots checked into
`../public/multi-resume-kit/` were built this way and committed as static
artifacts.
