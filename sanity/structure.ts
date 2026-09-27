import type { StructureResolver } from "sanity/structure";
import { DocumentPdfIcon } from "@sanity/icons/DocumentPdf";
import { CheckmarkCircleIcon } from "@sanity/icons/CheckmarkCircle";

/**
 * Custom Studio structure separating editorial content from application records.
 * - Documents and Rules are editorially reviewed and published.
 * - Conversations and Messages are runtime app records and are intentionally
 *   NOT exposed as browsable lists in Studio UI (accessible only by exact ID if inspected).
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Compliance Content")
    .items([
      // Editorial Section: Source Compliance Documents
      S.listItem()
        .title("Compliance Documents")
        .icon(DocumentPdfIcon)
        .child(
          S.documentList()
            .title("Compliance Documents")
            .filter('_type == "complianceDocument"')
            .defaultOrdering([{ field: "uploadedAt", direction: "desc" }])
        ),

      // Editorial Section: Reviewed Compliance Rules
      S.listItem()
        .title("Compliance Rules")
        .icon(CheckmarkCircleIcon)
        .child(
          S.list()
            .title("Compliance Rules")
            .items([
              S.listItem()
                .title("All Rules")
                .child(
                  S.documentList()
                    .title("All Rules")
                    .filter('_type == "complianceRule"')
                ),
              S.listItem()
                .title("Pending Review (Drafts)")
                .child(
                  S.documentList()
                    .title("Pending Review (Drafts)")
                    .filter('_type == "complianceRule" && _id in path("drafts.**")')
                ),
              S.listItem()
                .title("Published Rules")
                .child(
                  S.documentList()
                    .title("Published Rules")
                    .filter('_type == "complianceRule" && !(_id in path("drafts.**"))')
                ),
              S.listItem()
                .title("Current Rules")
                .child(
                  S.documentList()
                    .title("Current Rules")
                    .filter('_type == "complianceRule" && freshnessStatus == "current"')
                ),
              S.listItem()
                .title("Stale / Superseded Rules")
                .child(
                  S.documentList()
                    .title("Stale or Superseded Rules")
                    .filter('_type == "complianceRule" && freshnessStatus != "current"')
                ),
            ])
        ),
    ]);
