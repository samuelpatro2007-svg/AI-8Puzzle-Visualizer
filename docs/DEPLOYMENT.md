# Deploying to GitHub and GitHub Pages

## 1. Create the repository
1. Sign in to GitHub, then click **New repository**.
2. Name it **`AI-8Puzzle-Visualizer`**, set it to **Public**, and **don't** add a README (one is already included).

## 2. Push the code
From inside the project folder:
```bash
git init
git add .
git commit -m "AI 8-Puzzle Visualizer – Greedy Best First Search (24BCE0867)"
git branch -M main
git remote add origin https://github.com/samuelpatro2007-svg/AI-8Puzzle-Visualizer.git
git push -u origin main
```
(Alternatively: on the empty repository page click **uploading an existing file** and drag in the folder contents, so that `index.html` sits at the top level.)

## 3. Turn on GitHub Pages
1. Repository → **Settings** → **Pages**.
2. **Source:** *Deploy from a branch* · **Branch:** `main` · **Folder:** `/ (root)` → **Save**.
3. After about 1–2 minutes the site is live at
   `https://samuelpatro2007-svg.github.io/AI-8Puzzle-Visualizer/`

The empty `.nojekyll` file in the root tells GitHub Pages to serve the files as-is.

## 4. Add the demo video
- Record the demo video (see `demo-video-script.md`) and save it as `assets/demo-video.mp4`. Files over 100 MB are rejected by GitHub, so compress it first (e.g. HandBrake, 720p) or upload to YouTube as *Unlisted* and put that link in the README.
- Commit and push again.

## 5. VTOP submission PDF
Put these URLs in a PDF and upload it on VTOP:
1. GitHub repository URL
2. GitHub Pages live URL
3. README URL: `https://github.com/samuelpatro2007-svg/AI-8Puzzle-Visualizer/blob/main/README.md`
4. Demo video URL (repository file link or YouTube link)
