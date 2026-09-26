# Contributing

Use one issue for each bounded piece of work. Assign one owner and write observable acceptance criteria before starting.

## Daily workflow

```sh
git switch main
git pull --ff-only
git switch -c feat/short-description
# Make and verify your changes.
python3 scripts/check_repo.py
git add <specific-files>
git commit -m "Describe the change"
git push -u origin HEAD
```

Open a pull request against `main`. Link the issue, describe what works, and include relevant validation or screenshots. Ask one available teammate to review. Any teammate may review another person's work; do not self-approve.

Merge using a merge commit to preserve individual contributions and original commits. Do not squash or rebase shared history during the hackathon. Delete merged feature branches. For conflicts, merge the latest `main` into your feature branch and resolve locally.

## Small-team conventions

- Keep PRs small and integrate throughout the day. Avoid four long-lived personal branches.
- Before editing shared contracts or dependencies, tell the team in the relevant issue.
- A workstream owner coordinates a folder; they do not have exclusive permission to change it.
- Keep `main` demonstrable once the first working slice lands.
- Update README status when a feature becomes functional; do not claim planned work is complete.
- Use your own Git identity. Check `git config user.name` and `git config user.email`; a GitHub-provided noreply address is suitable for a public repo.
- Keep API keys in local ignored environment files and deployment secrets, never commits or screenshots. Browser code must not receive private API keys.
- Do not add the supplied participant packet, spreadsheet, private mentor notes, or unrelated local files to the public repository.

## Before merging

Run the repository check plus tests relevant to changed functionality. Data/math changes should include a small independently verified example, including a missing-data case. UI changes should include a screenshot and a basic keyboard check. Add app lint/build/test commands to CI as soon as the app exists.
