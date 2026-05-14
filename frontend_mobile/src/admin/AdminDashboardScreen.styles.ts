import { StyleSheet } from "react-native";
import { theme, fonts } from "../theme";

export const styles = StyleSheet.create({
  errorCopy: {
    color: theme.danger,
    ...fonts.bold,
    marginBottom: -4,
  },
  kpiGrid: {
    gap: 12,
  },
  kpiCard: {
    gap: 6,
  },
  kpiLabel: {
    color: theme.textMuted,
    textTransform: "uppercase",
    fontSize: 11,
    ...fonts.extrabold,
    letterSpacing: 1,
  },
  kpiValue: {
    color: theme.primary,
    fontSize: 30,
    ...fonts.black,
  },
  sectionTitle: {
    fontSize: 22,
    ...fonts.black,
    color: theme.text,
    marginBottom: 14,
  },
  listCard: {
    backgroundColor: "#f8faf7",
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  rowTitle: {
    ...fonts.extrabold,
    color: theme.text,
  },
  rowCopy: {
    marginTop: 4,
    color: theme.textMuted,
  },
  emptyCopy: {
    color: theme.textMuted,
    ...fonts.semibold,
  },
  actionGroup: {
    gap: 8,
  },
  healthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  disasterCard: {
    backgroundColor: "#f8faf7",
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 18,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  disasterHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  phaseActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  formGroup: {
    gap: 8,
    marginBottom: 10,
  },
  formLabel: {
    ...fonts.extrabold,
    fontSize: 12,
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  formInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: "#f8faf7",
    color: theme.text,
    paddingHorizontal: 12,
    ...fonts.semibold,
  },
  formTextarea: {
    minHeight: 104,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: "#f8faf7",
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...fonts.semibold,
  },
  channelRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
});
