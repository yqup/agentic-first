# Orchistra control panel refresh

Date: 2026-09-15

## Positioning

Orchistra is presented as the control panel for people, AI agents, and company
work. The headline is "See what's moving. Know what needs you." The model has
four steps: set direction, coordinate work, review and approve, learn from
results. Both principal-led and organisation-integrated use remain represented.

Existing capability qualifications and the distinction between working,
being-proven, and future features remain. Finance, CRM, HR, banking, customer,
and specialist systems retain their authoritative records. No new integration
or autonomous authority is promised.

## Presentation

The existing countryside, conservatory, console, and social images are retained.
Orchistra-only presentation assets add glass navigation, brighter hero lighting,
stronger product shadows, fixed responsive typography, and lighter sections.
The moving hero is an animated still image, not a video download. A small CSS
pan and product float supply movement without a new media or runtime dependency.

Motion has a pause/resume button, follows reduced-motion settings, and pauses
when the document is hidden or the animated surface is outside the viewport.
Content is readable without JavaScript; section entrances never gate access to
content. The mobile menu closes on selection and Escape.

The source remains sites.json plus the Orchistra template in build-sites.mjs.
Dedicated presentation.css and presentation.js are copied by the existing
asset pipeline. Other sites do not load these assets. Matomo campaigns, CTA
destinations, social image bytes, and public API behavior are preserved.

## Verification and review

Build, JavaScript syntax checks, social preview and public discovery validators,
and git diff --check are required. Browser QA covers 1440x900, 1024x768,
390x844, and 1920x1080; motion and pause/resume; reduced motion; navigation;
image loading; CTA attributes; text fit; and no-JavaScript readability.

The local preview is http://127.0.0.1:8220/. This refresh requires Tony's local
review before production promotion through the existing top-level-sites gate.
This note records source and preview work, not a production deployment.

Verification on 2026-09-15 passed the build, syntax, social/discovery, and diff
checks. Playwright passed all four viewport checks, keyboard/menu navigation,
pause/resume, reduced motion, image loading, and no-JavaScript readability, with
no page errors. Tracked outbound anchors match the previous HTML exactly.
Other-site metadata and generated output are unchanged. Browser QA used the
local Playwright CLI because the Browser plugin was not available in this session.
