import complianceDocument from "./complianceDocument";
import complianceRule from "./complianceRule";
import conversation from "./conversation";
import message from "./message";
import industry from "./industry";
import chapter from "./chapter";

export const schemaTypes = [
  // Milestone 2 core compliance models
  complianceDocument,
  complianceRule,
  conversation,
  message,

  // Deprecated legacy models (preserved for dataset migration safety)
  industry,
  chapter,
];
