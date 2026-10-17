# Fieldnotes Library

Synthetic document archive with a real browser form, Node HTTP API and local JSON files.
No dependencies. Start: `npm start`, port 3210 or PORT. Only synthetic notes are used.

The UI writes a title and text through POST /api/notes and lists stored notes after
another request. Individual notes can be read, deleted and downloaded as UTF-8 text.
Download implements HEAD and If-None-Match/304. Validation returns 400/422; missing
notes return 404. Files live in ./ship-data (gitignored); directory creation occurs
only on first write so health and UI independently isolate filesystem failures.

This experiment asks whether ordinary Node filesystem state persists across HTTP
requests and deployment on Dev-Void. Persistence is a measured question, not an
assumed platform guarantee. Restart is deferred while the known Carrier restart
recursion remains unqualified on the fleet. No secret or user data belongs here.
