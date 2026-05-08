Treat the centipede game as the permanent shell. Do not turn it into a blog
frontend. The content system should attach to the ecology like mycelium: mostly
invisible, alive elsewhere, only surfacing when the world has reason to expose
it.

Moral intent paragraph for the link/artifact layer:

The writing should not sit in a public pile waiting to be scraped. It should
appear as something the world chooses to surface. Early on, or in a ruined
world, you get shallow facts and small traces. A name. A signal. Maybe one easy
leaf. The real artifacts live where the world has become bright enough to hold
them. You earn traversal by creating the conditions for traversal: cooperation,
patience, risk, enough stubborn brightness to keep moving through the dark. When
a golden leaf appears, it is not just a link. It is the world trusting you with
something. If you poison the place, the world gets dimmer and less legible
because that is the world your conduct creates. If you help maintain it, it
becomes more navigable and more willing to reveal what it protects. Discovery
should feel earned without becoming a puzzle. The site should not ask “can you
solve me?” It should ask “can you live here well enough for beautiful things to
appear?”

Technically, I’d build it as four layers.

First: keep the game layer almost pure. WorldCanvas owns simulation state, world
health, player body length, star count, trust/social-weather parameters,
discovered leaves, and current overlay state. Your current app already keeps the
canvas mounted across route changes to preserve world state, which is the right
instinct. The existing hash-route structure has clearing, notes, artifacts, and
bio, and comments explicitly say WorldCanvas stays mounted to preserve world
state. I’d evolve that away from route pages as primary navigation and toward
artifact overlays.

Second: add an artifact-oracle API. The frontend should periodically say
something like:

POST /api/world/tick
{
    sessionId,
      worldStateDigest,
        playerState: {
              heightBand,
                  bodyLength,
                      cooperationRate,
                          defections,
                              starsCreated,
                                  starsDestroyed,
                                      reachableRegionIds,
                                          elapsedTime,
                                            },
                                              recentEvents: [...]
}

The backend responds with zero or more “manifestations”:

{
    manifestations: [
        {
                instanceId: "disc_7f3c...",
                      artifactId: "comb-compiler-notes",
                            kind: "golden_leaf",
                                  regionId: "upper_canopy_east",
                                        spawn: { x, y, seed },
                                              aura: "warm_gold",
                                                    expiresAt: null
                                                        }
                                                          ]
}

The key is instanceId. The artifact has a stable identity, but each discovery
has its own identity. You are minting “this visitor found this artifact through
this world-state,” not just serving /posts/comb.

Third: make artifact opening a ceremony, then normal reading. When the player
touches/clicks the leaf, call:

POST /api/discoveries/:instanceId/open

Backend validates that the discovery belongs to this session and is still valid.
Then it returns the content payload or a signed URL to fetch it.

The canvas freezes. Blur the world behind. Open an overlay. The page can be
boring in the good way: HTML, text, images, diagrams, code blocks. Reading
should not be hostile. The threshold already happened in the world.

Fourth: share links should point to discoveries, not posts.

Example:

/s/d/7f3c9a1e0b...

Following that link opens the artifact directly, maybe with a small line like
“found by another traveler” if you want. When they close it, they return to the
clearing, seeded with a trace of the origin discovery: a ghost centipede, a star
trail, a dragon in the canopy, a faint route of light leading away from where
the artifact would have been. The share link can also create a new session with
refDiscoveryId = ..., so the ecology knows this visitor arrived through someone
else’s passage.

I would avoid storing raw IP unless you really need it. You can get virality
with discovery_id, ref_discovery_id, session_id, timestamp, user agent hash,
coarse geo if you care, and referrer. Raw IP is gross baggage. Hashing it with a
rotating salt is enough if you want approximate uniqueness without building a
creepy analytics panopticon.

A minimal database shape:

artifacts (
  id text primary key,
    slug text,
      title text,
        kind text,
          visibility_tier int,
            content_url text,
              created_at timestamp
              )

sessions (
  id uuid primary key,
    created_at timestamp,
      last_seen_at timestamp,
        ref_discovery_id uuid null,
          world_seed text,
            conduct_summary jsonb
            )

discoveries (
  id uuid primary key,
    artifact_id text references artifacts(id),
      session_id uuid references sessions(id),
        created_at timestamp,
          opened_at timestamp null,
            share_token text unique,
              world_state_digest text,
                discovery_context jsonb
                )

events (
  id bigserial primary key,
    session_id uuid,
      type text,
        created_at timestamp,
          payload jsonb
          )

The frontend should never ship the full artifact manifest. It can know “there
may be leaves.” It should not know all slugs, titles, or content IDs. The
backend decides what can manifest based on the sessions world state and returns
only the specific discoveries it mints. Someone can still reverse-engineer
anything eventually because the browser is hostile territory, but you can make
casual inspection fail. That’s enough. You are building defensive illegibility,
not Fort Knox.

The access rules should be simple at first:

Surface tier: available near bottom or early. Name, tiny bio fragment, one
welcome artifact.

Middle tier: requires some world health, some traversal, some cooperation
history. Project posts, lighter essays, technical fragments.

High tier: requires upper-canopy reach, sustained world health, low defection,
enough stars. More personal writing, stranger essays, deeper technical pieces.

Recovery rule: a bad visitor is not permanently damned. They can repair the
world, but slowly. Cooperation should be modest. Damage should be easier than
repair. That is the moral physics.

Implementation order:

Build local artifact spawning first with fake content. No backend. Prove the
feeling.

Then add backend mints with stub content.

Then add overlay rendering.

Then add share links.

Then add provenance ghosts.

Then hide real content behind the artifact service.

Do not start with the perfect hidden blog platform. Start with the ceremony:
golden leaf appears, opens artifact, freezes world, share link says “this was
found.” If that feels right, the architecture can deepen under it.
