# Security policy

Cirrava's contracts are live on Robinhood Chain mainnet and hold real assets. They have **not** been audited.

## Reporting a vulnerability

Please **do not** open a public issue, pull request or post for a security problem.

Report it privately through GitHub:
**[Security → Report a vulnerability](https://github.com/cirrava/cirrava-xyz/security/advisories/new)**.

If that is not possible, send a direct message to [@Cirrava on X](https://x.com/Cirrava) asking for a
private channel — do not include details of the issue in the first message.

Helpful to include:

- the contract and address affected (see [`protocol/deployments/robinhood.json`](protocol/deployments/robinhood.json)),
- the commit you reviewed,
- steps or a test that reproduces it (a local fork of Robinhood Chain is ideal),
- the impact you expect.

## Scope

- Contracts in [`protocol/contracts`](protocol/contracts) and their deployed instances.
- The website and app at https://cirrava.xyz.

Out of scope: Robinhood Stock Tokens, USDG and Chainlink feeds themselves (report those to their issuers),
and any testing against the live contracts or users. Please test on a local fork only.

## What we will never ask for

Cirrava will never ask you for a private key, seed phrase, wallet signature or payment.
Anyone who does is not us.
