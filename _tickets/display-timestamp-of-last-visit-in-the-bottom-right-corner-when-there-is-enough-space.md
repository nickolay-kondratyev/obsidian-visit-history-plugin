---
id: nid_38nug4v7v30e1pe2r4bsrque2_e
title: "Display timestamp of last visit in the bottom right corner when there is enough space"
status: open
deps: []
links: []
created_iso: 2026-10-22T17:37:59Z
status_updated_iso: 2026-10-22T17:37:59Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
---

Display timestamp in the right bottom corner in the vault heat map when there is enough space.

I am thinking make it human readable, 

So something like '3d ago' - would be if we are on the order of day+

12h ago if we are in the order of <day.
33m ago if we in the order of <hour. 


We only want this display to appear if there is enough space in the tile, that means there should be enough space for title, then empty line and another line that can be used. So that the title and the timestamp do not appear squished.
