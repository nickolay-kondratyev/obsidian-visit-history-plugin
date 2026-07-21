---
id: nid_xpq8zb8euhzd26bxbp6150dgt_e
title: "ability to override config for e2e"
status: open
deps: []
links: []
created_iso: 2026-07-21T23:09:09Z
status_updated_iso: 2026-07-21T23:09:09Z
type: task
priority: 1
assignee: nickolaykondratyev
---


GOAL: be able to override configurations even those that are hard limited in the app during e2e.

Use case: be able to have specific e2e test for idle time without having to have e2e test wait 30 seconds.

Approach: have special environment variable set as __VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__ that points to a JSON file with overrides, these overrides can contain overrides even for things that are not exposed through configuration. Such that we can set special values in our e2e test. 

At the end of this we should be able to have this file and wire up e2e test to test for idling time.

Let's make sure the interaction with this __VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__ is well abstracted and we have some ConfigProvider interface that hides usage of this from the rest of the code.

