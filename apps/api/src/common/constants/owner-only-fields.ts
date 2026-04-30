// Re-exports the OWNER_ONLY_FIELDS map from @agency/shared so backend-only modules can
// import without crossing into the shared package paths in their decorators.
export { OWNER_ONLY_FIELDS, FINANCIAL_VISIBLE_ROLES } from '@agency/shared';
