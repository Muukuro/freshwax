# Defer secondary release trait filters

Freshwax currently stores a release with one `ReleaseType`, but the product language distinguishes primary listening formats like albums, EPs, and singles from secondary traits like live, compilation, reissue, and remaster. We will ship the `/recent` listening surface with explicit primary format filters only and keep secondary traits controlled by persistent settings until the data model can represent primary format and secondary traits separately.
