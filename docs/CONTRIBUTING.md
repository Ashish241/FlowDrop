# Contributing

Keep offline runtime independent from all hosted services. Use generated storage identifiers and scoped capabilities; never expose filesystem paths or log credentials. Preserve explicit device and receiver approval. Do not add third-party assets to offline pages.

Before submitting a change, run backend lint/tests and frontend unit/type/build checks. Run Playwright for changes affecting user flows. Include regression tests for meaningful security and transfer failure cases. Document the actual tested environment; distinguish ASGI simulations, real browsers, real network devices and pending physical checks.

Update IMPLEMENTATION_STATUS.md with remaining work. Experimental modes must remain labeled. Do not claim production readiness or universal network compatibility. External deployments and repository publication require authorization.
