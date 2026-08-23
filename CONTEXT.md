# LoreBook Previewer context

## Glossary

| Term | Meaning |
| --- | --- |
| Lorebook | A SillyTavern world-info JSON document containing an `entries` collection. |
| Character card | A separate document format that may embed a Lorebook at `data.character_book`; it is not itself a Lorebook. |
| Entry | One human-readable context rule in a Lorebook. It has content plus optional activation and display metadata. |
| Keyword | A primary activation string in an Entry's `keys` field. Secondary keywords are represented separately. |
| Import | Converting JSON supplied from a file, drop, paste, or URL into the display-oriented Lorebook model. |
| Normalization | A permissive conversion from the exported JSON shape to a stable display model while retaining unknown fields in `raw`. |
| Adapter | An importer implementation that recognizes and normalizes exactly one document format. |
