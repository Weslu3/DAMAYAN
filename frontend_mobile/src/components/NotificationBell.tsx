import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { theme } from "../theme";
import type { AppNotification } from "../api";

const TYPE_ICON: Record<string, string> = {
  approval_approved: "✓",
  approval_rejected: "✕",
  alert: "!",
  dispatch_assigned: "→",
  incident_update: "↑",
  system: "i",
};

const TYPE_COLOR: Record<string, string> = {
  approval_approved: theme.success,
  approval_rejected: theme.danger,
  alert: theme.warning,
  dispatch_assigned: theme.info,
  incident_update: theme.secondary,
  system: theme.neutral,
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface NotificationBellProps {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.bell} onPress={() => setOpen(true)}>
        <Text style={styles.bellIcon}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : String(unreadCount)}
            </Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} />
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Notifications</Text>
            <View style={styles.panelActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    onMarkAllRead();
                  }}
                  style={styles.markAllBtn}
                >
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
          </View>

          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔕</Text>
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.item, !item.read && styles.itemUnread]}
                  onPress={() => {
                    if (!item.read) onMarkRead(item.id);
                  }}
                >
                  <View
                    style={[
                      styles.typeIcon,
                      { backgroundColor: TYPE_COLOR[item.type] ?? theme.neutral },
                    ]}
                  >
                    <Text style={styles.typeIconText}>
                      {TYPE_ICON[item.type] ?? "i"}
                    </Text>
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemText} numberOfLines={2}>
                      {item.body}
                    </Text>
                    <Text style={styles.itemTime}>
                      {formatRelativeTime(item.created_at)}
                    </Text>
                  </View>
                  {!item.read && <View style={styles.unreadDot} />}
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: {
    fontSize: 22,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "75%",
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.text,
  },
  panelActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: theme.primarySoft,
  },
  markAllText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  list: {
    paddingVertical: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  itemUnread: {
    backgroundColor: theme.primarySoft,
  },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  typeIconText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.text,
  },
  itemText: {
    fontSize: 13,
    color: theme.textMuted,
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 11,
    color: theme.textLight,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
    marginTop: 4,
    flexShrink: 0,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
});
