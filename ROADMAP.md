THINGS WE WANT TO DO
=====================

1. command line interface
2. command for zipping a version of the db encrypted with the db public key (or a trusted key)
3. transactions, so startTransaction('txName') then set('/blah', {tx:'txName'}).then(delete('/blah', {tx:'txName'})).commitTransaction('txName')
4. security auditing by configuration
5. mongo plugin v2 
6. security data encryption on db file

OPTIMISATIONS/ISSUES
====================
1. usage og bigint in the data ie. {bigint:"0.77blahblahblah"}, so items that are linked to financial transactions dont do any odd rounding
2. on events to be deduplicated by path wildcard
