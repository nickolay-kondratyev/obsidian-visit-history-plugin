We need to add user id as part of the folder structure in visit history.

Let's also add simple migration for the currently used vaults that have direct .visit_history/v1 .visit_history/v2 that will be moved under username structure

The structure will be as follows .visit_history/user/<username>/v2/...  .visit_history/user/<username>/v3/... V2 and V3 will be moved respectively.

Also add a comment into the migration that such migrations should be cleaned up after 2026-October.

<username>:

On Mobile we should do the following:
- if there is just 1 username in visit history use that one.
- if there are multiple usernames in visit history then create see if you can get username from the device APIs, if you cannot then fallback to creating some persistent UUID for username. 


