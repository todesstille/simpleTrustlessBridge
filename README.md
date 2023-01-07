# simple Trustless Bridge

At this moment only transfers operational token (bTKN)

Contract should be deployed in two networks, that support secp256k1

Alice deposits bTKN to the bridge in network1, with the parameters to transfer bTKN to network2 bob.address

bTKN are locked for 1 hour

During this time Admin MUST call send() function with his signature included, claiming alice bTKN

This action will reveal a signature, which could be used to transfer bTKN from bridge in network2 to bob.address.

If Admin doesn't call send() function, Alice could revoke her deposit from contract in network1

(Actually, to avoid the situation when Alice revokes her funds in the same transaction, when Admin reveals
opening signature, he should call send() function some time before the deadline)