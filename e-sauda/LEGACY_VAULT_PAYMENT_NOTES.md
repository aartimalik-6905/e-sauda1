# Legacy Razorpay / Vault migration note

Razorpay is no longer used for seller listing fees. Listing fees use Cashfree;
see `CASHFREE_SETUP.md`.

This filename is retained only because older deployment notes and historical
database migrations may reference it. Do not configure Razorpay credentials for
the current listing-fee checkout. Do not drop the historical Razorpay/Vault SQL
tables until the Vault payment workflow and all production data dependencies
have been audited separately.
