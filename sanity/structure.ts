import type { StructureResolver } from "sanity/structure";
import { DocumentPdfIcon } from "@sanity/icons/DocumentPdf";
import { CheckmarkCircleIcon } from "@sanity/icons/CheckmarkCircle";
import { ClockIcon } from "@sanity/icons/Clock";
import { WarningOutlineIcon } from "@sanity/icons/WarningOutline";
import { ArchiveIcon } from "@sanity/icons/Archive";
import { FolderIcon } from "@sanity/icons/Folder";
import { CommentIcon } from "@sanity/icons/Comment";

/**
 * Milestone 4 dedicated Studio structure:
 * - Source Documents: ordered by uploadedAt desc, filtered by processing status & industry.
 * - Rules Awaiting Review: compliance rules whose draft exists or lastReviewedAt is missing.
 * - Published Rules: verified rules grouped by freshness status and industry.
 * - App Records: runtime conversations and messages separated from the editorial workflow.
 */
export const structure: StructureResolver = (S) =>
  S.list()
    .title("Compliance Studio")
    .items([
      // ----------------------------------------------------------------------
      // 1. Source Documents
      // ----------------------------------------------------------------------
      S.listItem()
        .title("Source Documents")
        .icon(DocumentPdfIcon)
        .child(
          S.list()
            .title("Source Documents")
            .items([
              S.listItem()
                .title("All Documents (Newest First)")
                .icon(DocumentPdfIcon)
                .child(
                  S.documentList()
                    .title("All Source Documents")
                    .filter('_type == "complianceDocument"')
                    .defaultOrdering([{ field: "uploadedAt", direction: "desc" }])
                ),
              S.listItem()
                .title("Ready for Review")
                .icon(CheckmarkCircleIcon)
                .child(
                  S.documentList()
                    .title("Ready Documents")
                    .filter('_type == "complianceDocument" && processingStatus == "ready"')
                    .defaultOrdering([{ field: "uploadedAt", direction: "desc" }])
                ),
              S.listItem()
                .title("In Processing")
                .icon(ClockIcon)
                .child(
                  S.documentList()
                    .title("Processing Documents")
                    .filter('_type == "complianceDocument" && processingStatus == "processing"')
                    .defaultOrdering([{ field: "uploadedAt", direction: "desc" }])
                ),
              S.listItem()
                .title("Extraction Failed")
                .icon(WarningOutlineIcon)
                .child(
                  S.documentList()
                    .title("Failed Documents")
                    .filter('_type == "complianceDocument" && processingStatus == "failed"')
                    .defaultOrdering([{ field: "uploadedAt", direction: "desc" }])
                ),
            ])
        ),

      S.divider(),

      // ----------------------------------------------------------------------
      // 2. Rules Awaiting Review (Drafts)
      // ----------------------------------------------------------------------
      S.listItem()
        .title("Rules Awaiting Review")
        .icon(ClockIcon)
        .child(
          S.documentList()
            .title("Rules Awaiting Review")
            .filter(
              '_type == "complianceRule" && (_id in path("drafts.**") || !defined(lastReviewedAt))'
            )
            .defaultOrdering([{ field: "_createdAt", direction: "desc" }])
        ),

      // ----------------------------------------------------------------------
      // 3. Published Rules
      // ----------------------------------------------------------------------
      S.listItem()
        .title("Published Rules")
        .icon(CheckmarkCircleIcon)
        .child(
          S.list()
            .title("Published Rules")
            .items([
              S.listItem()
                .title("All Published Rules")
                .icon(CheckmarkCircleIcon)
                .child(
                  S.documentList()
                    .title("All Published Rules")
                    .filter('_type == "complianceRule" && !(_id in path("drafts.**"))')
                    .defaultOrdering([{ field: "ruleName", direction: "asc" }])
                ),
              S.listItem()
                .title("Current Regulations")
                .icon(CheckmarkCircleIcon)
                .child(
                  S.documentList()
                    .title("Current Published Rules")
                    .filter(
                      '_type == "complianceRule" && !(_id in path("drafts.**")) && freshnessStatus == "current"'
                    )
                    .defaultOrdering([{ field: "ruleName", direction: "asc" }])
                ),
              S.listItem()
                .title("Stale Regulations")
                .icon(ClockIcon)
                .child(
                  S.documentList()
                    .title("Stale Rules")
                    .filter(
                      '_type == "complianceRule" && !(_id in path("drafts.**")) && freshnessStatus == "stale"'
                    )
                    .defaultOrdering([{ field: "ruleName", direction: "asc" }])
                ),
              S.listItem()
                .title("Superseded Regulations")
                .icon(ArchiveIcon)
                .child(
                  S.documentList()
                    .title("Superseded Rules")
                    .filter(
                      '_type == "complianceRule" && !(_id in path("drafts.**")) && freshnessStatus == "superseded"'
                    )
                    .defaultOrdering([{ field: "ruleName", direction: "asc" }])
                ),
            ])
        ),

      S.divider(),

      // ----------------------------------------------------------------------
      // 4. App Records (Conversations & Messages)
      // Separated from editorial workflow
      // ----------------------------------------------------------------------
      S.listItem()
        .title("App Records")
        .icon(FolderIcon)
        .child(
          S.list()
            .title("App Records (Runtime Only)")
            .items([
              S.listItem()
                .title("Conversations")
                .icon(CommentIcon)
                .child(
                  S.documentList()
                    .title("Research Conversations")
                    .filter('_type == "conversation"')
                    .defaultOrdering([{ field: "createdAt", direction: "desc" }])
                ),
              S.listItem()
                .title("Messages")
                .icon(CommentIcon)
                .child(
                  S.documentList()
                    .title("Messages")
                    .filter('_type == "message"')
                    .defaultOrdering([{ field: "createdAt", direction: "desc" }])
                ),
            ])
        ),
    ]);
