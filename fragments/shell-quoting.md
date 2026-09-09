## Getting text through the shell alive

**Write the script to a FILE, then run the file.** A patch, a runner, a JSON payload, a replacement
paragraph, a commit message: written with a file-writing tool first and executed by path, never
inline into `bash -c`. Everything below is why.

**Measured in one project over four weeks: 62 tool calls lost, none of which ran.** 54 unterminated
single quotes, 6 double, 2 backticks, every one exit code 2. Their heredocs were correct, over a
thousand of them with quoted delimiters. It was never the heredoc; it was the quoting around it.

**Backticks are the worst, because they do not announce themselves.** A backtick pair in a
double-quoted shell string is command substitution: the shell runs what is between them and drops
the output into your text. Here that silently deleted three code references from a paragraph and
reported success. An unterminated quote at least fails loudly; this hands you a corrupted result
and calls it done. So no backticks inside a double-quoted string, and single-quote anything holding
a `$` or a `!`. Markdown almost always contains backticks, which is why markdown belongs in a file.

**Read the result back after writing through a shell.** Not ceremony: that failure is invisible when
it happens and obvious the moment you look.

**A backslash does not survive the shell layer.** If the content has escapes in it, it goes in a
file. In PowerShell use a single-quoted here-string, `@'` to `'@`, with the terminator at column 0.
