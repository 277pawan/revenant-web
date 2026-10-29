import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { PageHeader } from "../components/layout/PageHeader";

const checks = [
  ["RDB capture", "The Redis server streams an RDB backup to the proof worker."],
  ["Restore load", "A temporary, isolated Redis process loads that exact RDB."],
  ["Redis responds", "The restored server answers PING after loading."],
  ["Key count", "The restored key count is compared with the source count."],
  [
    "Keyspace digest",
    "A bounded sample from the restored keyspace is hashed; raw keys and values are not shown in the dashboard.",
  ],
];

export function RedisGuidePage() {
  return (
    <AppShell>
      <PageHeader
        title="Redis restore proof guide"
        description="What Revenant captures, what it validates, and what happens after a proof."
      >
        <Link
          to="/redis"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to Redis
        </Link>
      </PageHeader>

      <div className="mx-auto max-w-4xl space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">What is Redis?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Redis is a fast in-memory data store commonly used for caches, queues, and
            short-lived application data. If Redis is configured to persist data, it
            periodically writes an RDB file. A successful connection test only proves
            Revenant can reach Redis; it does not prove that the saved RDB can be loaded.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            How capture and validation work
          </h2>
          <ol className="mt-4 space-y-3">
            {[
              "The website creates a proof record for the Redis resource. You do not upload a file or write a validation script.",
              "Revenant's cloud runner claims the run automatically — there is nothing extra for you to deploy or keep online.",
              "The runner asks your Redis server to stream its RDB over the connection. It does not need access to the Redis host's filesystem.",
              "The runner starts a temporary, isolated Redis instance and loads the captured RDB into it. This instance is not connected to your production Redis.",
              "Revenant records the restore checks and timings, then tears down the temporary instance. The result appears under Proofs.",
            ].map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {checks.map(([name, description]) => (
              <div key={name} className="rounded-lg border border-slate-200 p-3">
                <h3 className="text-sm font-medium text-slate-900">{name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Proofs versus snapshots
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            A restore proof is the validation result. Snapshot storage is a separate,
            optional choice: when enabled, Revenant keeps the captured RDB artifact in
            object storage until the displayed expiry time, then deletes it. When
            disabled, the RDB is used for the proof and discarded afterward. Proof
            records and snapshot records have separate searchable history pages.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/redis"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              Open Redis
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Finding older records</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            The Redis overview shows only recent activity. Open Proof history or Snapshot
            history for searchable records; each page shows 10 items with Previous/Next
            pagination so the page stays a manageable length.
          </p>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold text-amber-950">
            What recovery means here
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">
            A proof restores the backup only inside the temporary test instance. It
            never overwrites, pauses, or changes your live Redis. The current dashboard
            validates backups; it does not perform a one-click production failover or
            restore. A real recovery means bringing up a replacement Redis and restoring
            an available RDB to that replacement under your recovery procedure.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            How to create a proof
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
            <li>
              Open <Link className="font-medium text-brand underline" to="/redis">Redis</Link>,
              choose <strong>Add Redis</strong>, paste the connection URL, and test it.
            </li>
            <li>Save the Redis resource and select it from the list.</li>
            <li>
              Choose <strong>Run proof</strong>. The proof and its checks appear in
              Proofs — usually within a few seconds.
            </li>
            <li>
              If the Redis sits on a private network the cloud cannot route to,
              the run waits for the Revenant agent to pick it up from inside
              that network. The Proofs list tells you which of the two is
              running it.
            </li>
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            The connection test and the restore proof are different operations: a
            successful connection test does not run the RDB restore checks.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
