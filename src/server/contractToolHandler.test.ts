import type { ServerContext } from "@modelcontextprotocol/server";
import pino from "pino";
import { expect, it } from "vitest";
import { toolContract } from "../contracts/toolContracts.js";
import { AnalysisCancelledError } from "../domain/analysisErrorCore.js";
import { createEvidence } from "../domain/evidence.js";
import { err, ok } from "../domain/result.js";
import type { EvidenceMcpServer } from "./EvidenceMcpServer.js";
import { createEvidenceToolHandler } from "./contractToolHandler.js";
import { ToolResultDelivery } from "./toolResult.js";

it.each([
  ["decode_signal_recording", true],
  ["record_unknown", false],
] as const)(
  "keeps %s partial-error target-content provenance",
  async (name, targetContent) => {
    const evidence = createEvidence(
      undefined,
      { id: "fixture", name: "retained observation", version: "1" },
      {
        operation: name,
        parameters: {},
        result: { text: "completed before cancellation" },
      },
    );
    const delivery = new ToolResultDelivery(32768);
    const server = { delivery } as EvidenceMcpServer;
    const handler = createEvidenceToolHandler(
      server,
      async () =>
        err(new AnalysisCancelledError(name, { partialObservation: evidence })),
      pino({ level: "silent" }),
      () => ok("added" as const),
    )(toolContract(name));
    const context = {
      mcpReq: { signal: new AbortController().signal },
    } as ServerContext;
    const result = await handler({}, context);
    expect(result.isError).toBe(true);
    expect(result._meta).toEqual(
      targetContent
        ? { provenance: { untrusted_content: true, source: "analysis_target" } }
        : undefined,
    );
    expect(result.structuredContent).toMatchObject({
      error: {
        details: {
          partial_observation: {
            kind: "retained-evidence",
            evidence_id: evidence.evidence_id,
          },
        },
      },
    });
  },
);
