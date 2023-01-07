# simple Trustless Bridge

At this moment only transfer of operational token (bTKN)

Contract should be deployed in 2 networks supporting secp256k1

Alice deposits bTKN on the bridge in network1, with the parameters to transfer bTKN to network2 bob.address

bTKN are locked for a 1 hour

During this hour Admin should call a send() function with his signature included, claiming alice bTKN

This action will reveal a signature, which could be used to transfer bTKN from bridge in network2 to bob.address.

If Admin doesn't call send() function, Alice could revoke her deposit from contract in network1