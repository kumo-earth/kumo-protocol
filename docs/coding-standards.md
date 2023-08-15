
# Kumo Coding Standards

## General Repository Workflow
Just like many open source projects, we value a structured and clean working environment instead of chaos.
Therefore, we are maintaining this repository via the **triangular workflow**. 

Basically, this means you push to your personal fork of the repo, and open PRs from your fork to the main repository. See the image for an illustration of this. When you want the latest updates, you pull from the shared repository.

![Github triangular workflow](https://github.blog/wp-content/uploads/2015/07/5dcdcae4-354a-11e5-9f82-915914fad4f7.png?fit=2000%2C951)

Also see [this article](https://felipec.wordpress.com/2014/05/11/git-triangular-workflows/) for a deeper understanding and tips.

If you need any help, please reach out to the team. 

## Pull Requests
PR's on Github should generally be opened against the `dev` branch, from where we regularly merge into `main`. 
Long-lived feature branches that are opened directly on the shared `@kumodao/kumo-protocol` repo can make sense in certain cases, e.g. where a v2 with breaking changes is built, but this should be discussed with the core team.

## Git and Clean Code
### Git convention commit messages

We adopt the semantic/conventional commits to give direct context, on what the commit someone is looking at, is actually about:

Here are some examples:

- **chore**: this commit type are used when changes occur in updates that do not impact buildings or the product.

- **ci**: this commit type describe changes to CI configuration files and scripts

- **docs**: this commit type only have changes in documentation, as README or comments.

- **feat**: this commit type includes a new feature in its code base 

- **fix**: this commit type solves a problem, a mistake, a bug in its code base 

- **refactor**: this commit type should be used when a code change does not correct a system bug or add a new feature to the application. For example a rename or making the function leaner.

- **test**: this commit type describes the addition of missing tests, new specific tests or existing testing.

Further reading.:
 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
[Semantic Commits](https://mazer.dev/en/git/best-practices/git-semantic-commits/)

## Git commit message body

We aim for high quality commit messages which should not only have  a title that is summarizing the changes but also
 a body that should give additional context.
In the body, **always clearly explain the "why"**, i.e. the context and motivation for the change, not just the **"how"**.

The commit body is really helpful for easier code reviews. It also helps you and others navigating the codebase, e.g. to understand why some odd function exists.

Here are two examples:

```
feat(sol): added owner authentication

The commit adds an authentication mechanism via OZ AccessControl to improve the security
```

```
chore: removed dead code

The date function of this library is outdated and was not used anywhere.
```


## Git commit grouping

Maintaining a high standard in terms of how changes are grouped together
into commits is helpful for a clean history, and makes the life of reviewers easy. 
Here are some rules that you should try to adhere to:

- A commit should not break the tests or the CI/CD processes.
    - In other words, the commit should not depend on a subsequent commit within the same PR to fix an issue that it creates.

- A commit should be as small as possible, but no smaller.

  - For example, when adding a new feature, the new tests for that
    feature should be in the same commit. Ideally the
    documentation should too, at least if the documentation
    changes are small.

- A single commit should never mix unrelated changes.

  - For example, refactorings should never be mixed with bugfixes or new features.

- Think about what the PR is going to be looking like and whether the changes are better added to a separate branch

    - For example, if you are working on a feature A, and realize that an existing feature B lacks unit tests, do not add commits with unit tests for B, instead create a new branch addressing the issue.

- Make use of rebasing to improve the code quality

    - If you realize that your branch causes merge conflicts, please rebase your entire branch onto the updated local `dev` branch after doing a pull. 
    - If you for example introduce three separate commits that fix typos in the code comments, you can squash them into one during `git rebase`.