# Security

`server.mjs` is meant to run on your own machine. It listens on 127.0.0.1 only, refuses any `Host` header other than `127.0.0.1` or `localhost` on its port, needs a custom header and a JSON body on every POST, and runs the model with no tools, hooks, MCP servers or saved session. It uses your own Claude login and never sees or stores a key.

Do not expose it to a network. If you find a way to make it do more than that, please report it privately with GitHub's "Report a vulnerability" button on the Security tab rather than in a public issue.
