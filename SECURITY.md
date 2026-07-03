# Security Policy

## No Telemetry

Spectral Prism ships with no telemetry, no analytics, no beacons, and no phone-home behavior of any kind, in any deployment posture. The application makes network requests only to data stores the user explicitly opens (and, when configured, the request-authorization hook the deployment supplies). Air-gapped deployment is a supported, tested posture. Any change that would introduce telemetry is out of scope for this project, not a configuration option.

## Reporting a Vulnerability

Please report suspected vulnerabilities privately:

- Preferred: GitHub private vulnerability reporting on [PaulMRamirez/spectral-prism](https://github.com/PaulMRamirez/spectral-prism/security/advisories/new)
- Or email: paul.ramirez@gmail.com with subject line `[spectral-prism security]`

Please do not open public issues for suspected vulnerabilities. You can expect an acknowledgment within 7 days. Coordinated disclosure is appreciated; we will credit reporters unless they prefer otherwise.

## Scope Notes

Spectral Prism is a client-side application: it has no server component, no accounts, and stores no user data outside the browser. The most security-relevant surfaces are the parsers that consume external bytes (Zarr codecs, ENVI/GeoTIFF/NetCDF readers, `.spb` and `.sps` loaders), the worker message boundaries, and the deploy pipeline's CSP configuration; changes there receive a security review before merge (see `docs/autonomy/AUTONOMY-PLAN.md` Section 4).
