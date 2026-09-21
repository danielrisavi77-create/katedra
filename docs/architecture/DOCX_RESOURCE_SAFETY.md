# DOCX upload resource boundary

This check protects upload processing resources. It does not parse Word XML,
validate formatting, fields, citations or academic rules, or issue a compliance
verdict. Lekta remains the sole deterministic DOCX/compliance authority.

The existing 20 MiB compressed, 50 MiB expanded, 1000-entry and 100:1 limits are
retained. The consumer now verifies the actual ZIP directory/end boundaries,
local-header ranges and agreement, and the output of each stored/deflated entry.
Declared expanded sizes cannot authorize larger actual output. Deflate uses
Node's bounded convenience output and verifies consumed compressed input, so a
hidden second stream is rejected. Aggregate actual output must stay within the
same existing budget.

Ambiguous duplicate/path names, contradictory Unicode Path overrides, invalid
UTF-8 names, encryption, unsupported compression and ZIP64/multi-disk layouts
are rejected. No files are extracted to filesystem paths. Some nonstandard
containers previously accepted by the signature scan may now be rejected.
The compatibility test creates a real DOCX with the existing `docx` package and
extracts its text with the existing Mammoth parser after the resource check.

Regression fixtures are real ZIP containers with local records, central records
and EOCD. The old successful `validBuffer()` fixture had no valid local records
or EOCD; it was replaced rather than weakening the resource guard to accept it.
Tests cover forged expanded sizes, aggregate limits, hidden streams, name
overrides, unsafe paths, malformed directory boundaries and valid extraction.

Implementation reference: Node documents `maxOutputLength` for convenience
methods and the `info` result in [the zlib API](https://nodejs.org/api/zlib.html#class-options).
The bound predates Node 22; no Node 26-only option or new dependency is used.

## Remaining limit

This is not cancellable CPU isolation. The resource check and Mammoth still run
in the request process, and the existing promise timeout does not terminate
ongoing extraction. A worker/process boundary with hard termination, deployment
packaging proof and resource tests remains open before enabling material/agentic
processing for production. PDF/OCR cancellation likewise remains separate.
No activation flag changed. The constitutional choice about temporary server
content remains an owner decision described in `CURRENT_ARCHITECTURE.md`.
