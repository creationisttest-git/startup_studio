## Asking the CEO for a decision

**A decision goes to the CEO through the interactive multiple-choice prompt, so they answer by
CLICKING an option.** In Claude Code that is the `AskUserQuestion` tool. It is not a numbered list
typed into the body of a reply, and it is not an open question.

**The CEO raised this directly on 2026-09-13**, in their words: the other projects *"don't give me
mcq prompts to respond via click inputs"*. It is one of the two things the doctor watches most
closely, alongside brevity.

**Until that day this rule said the wrong thing.** It read *numbered options, so the reply can be a
single character*, which described the prose list rather than the prompt, and is exactly what was
being complained about. A prose list makes the founder read, scroll and type; the click does not,
and the prompt captures the answer as a value instead of leaving it in scrollback.

Four things go in the prompt, every time:

- **Two to four options**, each with a label and a description saying what happens if it is chosen.
  Options are mutually exclusive unless you deliberately allow several.
- **A recommendation**, named in the first option and marked `(Recommended)` in its label, with the
  reason in its description. Without it the founder is still doing the thinking, just from a
  shorter list.
- **An explicit escape as the last option**, always. A forced choice between options that are all
  wrong is worse than the open question it replaced. The host adds an "Other" of its own; write
  yours anyway, because yours can say what the escape would mean here.
- **The ticket reference** in the question text, whenever the project runs a board, so the decision
  is appended to the ticket rather than lost in the conversation.

**Write the board `ask` BEFORE you raise the prompt and the `answer` AFTER it.** In that order, so
the record cannot show an answer to a question nobody asked. The options in the two must match.

**MATCH MEANS THE SAME OPTIONS IN THE SAME ORDER, and both halves have been broken here.** Three
decisions in one sitting wrote four or three options to the board and put ONE FEWER to the founder,
dropping the explicit escape every time: nobody was trapped, because the host adds an Other of its
own, and that is exactly why it survived five rounds of checking. The prompt LOOKS complete and
what is wrong is the RECORD, which the next session cites and cannot tell from a true one. The
sitting after that kept the same options and put them in a different ORDER, shortening the labels
as well, because the prompt marks the recommendation first. An answer recorded as option 3 had been
clicked in position 1. The board stores the NUMBER and resolves the text from the option at that
position, so a reordering CAN write a ruling the founder did not give. On that occasion it did not,
and the record still described something the founder was never shown.

**So write the ask with the RECOMMENDED OPTION FIRST**, which is the one ordering that satisfies
both this rule and the recommendation rule above at the same time.

**The two sides will never read identically and they are not meant to.** The host caps a prompt
label at about eighty characters and a board option can be a full sentence, so a label is a short
paraphrase. What has to match is the SET and the ORDER, not the wording.

`node <studio>/tools/check-decision-shape.js --at-answer <ref>` is the check, and it is worth
knowing exactly what it can and cannot tell you before you rely on it. It refuses when the board
names more options than the prompt showed. It refuses when it can pair every label to an option and
finds them in a different order. **It prints CANNOT TELL, and passes, when it cannot compare the
two at all**: when a label paraphrases two options alike, or when the prompt showed MORE options
than the ask names, which is the one direction the refusal above cannot see. So a silent run is
not the same as a run that agreed with you. Read what it printed rather than its exit code.

**The sentence in bold above was a lie until 2026-09-22 and it is worth knowing why.** The
cannot-tell was
computed and never written to the screen, so a decision the check could not read came back as the
same bare OK as one it had read and agreed with, and there was nothing printed to read. Worse, a
single unreadable prompt anywhere in the window was treated as agreement and ERASED a real finding
already made against the same ask. Both were found by a reviewer running the case rather than
reading the code, in the round that shipped this paragraph.

Run it BEFORE the answer, because that is the only moment either fault is still fixable: for a
missing option raise the prompt again with all of them, and for a reordering put the ask and the
prompt in the same order. After the answer the only thing left to edit is the record, and a record
edited to agree with itself proves nothing.

**The prose numbered list is the fallback and nothing else.** Use it only where no interactive
prompt exists in the host you are running in, and say plainly that is why. A dispatched subagent
returning text to a driving session is the ordinary case for it: you have no prompt to raise, so
hand the driving session the options and let IT put the question.

**The value is upstream of the founder's convenience.** You cannot write the options until you have
actually thought the alternatives through, so the format forces the work the open question was
avoiding. If you cannot name two real options, you do not yet understand the decision well enough
to ask about it.

**Ask only what the founder alone can settle.** A question you could answer by reading the code,
running the tool or checking the record is not a decision, it is research you have not done.
Strategy, spend, priority and anything irreversible are theirs. Almost nothing else is.

**One question at a time where you can.** Several decisions bundled into one prompt get answered as
one, which usually means the smaller ones get answered by accident.

**State the number the decision rests on, and put it again if that number moves.** Approval given
against a figure that has since changed is not approval. Re-asking costs one prompt; not re-asking
converts their answer into something they did not give.
