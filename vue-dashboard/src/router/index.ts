import { createRouter, createWebHistory } from "vue-router";
import LoginView from "@/views/Auth/LoginView.vue";
import DashboardLayout from "@/layouts/DashboardLayout.vue";
import NotFoundView from "@/views/Others/NotFoundView.vue";
import UnauthorizedView from "@/views/Others/UnauthorizedView.vue";

import { useAuth } from "@/composables/useAuth";

// Rutas hijas del dashboard
const dashboardChildren = [
  {
    path: "",
    name: "DashboardHome",
    component: () => import("@/views/Dashboard/HomeView.vue"),
  },
  {
    path: "profile",
    name: "DashboardProfile",
    component: () => import("@/views/Dashboard/ProfileView.vue"),
  },
  {
    path: "settings",
    name: "DashboardSettings",
    component: () => import("@/views/Dashboard/SettingsView.vue"),
    meta: { requiresAdmin: true },
  },
  {
    path: "whatsapp",
    name: "DashboardWhatsApp",
    component: () => import("@/views/Dashboard/WhatsAppView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "chats",
    name: "DashboardChats",
    component: () => import("@/views/Dashboard/ChatsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: 'bots',
    name: 'BotManagement',
    component: () => import('@/views/Dashboard/BotManagement.vue'),
    meta: { requiresAuth: true },
  }
];

const routes = [
  { path: "/login", name: "Login", component: LoginView },
  {
    path: "/dashboard",
    component: DashboardLayout,
    children: dashboardChildren,
    meta: { requiresAuth: true },
  },
  { path: "/unauthorized", name: "Unauthorized", component: UnauthorizedView },
  { path: "/:pathMatch(.*)*", name: "NotFound", component: NotFoundView }, // 👈 404
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Guard de autenticación
router.beforeEach((to) => {
  const { accessToken, userRole } = useAuth();

  if (to.meta.requiresAuth && !accessToken.value) {
    return "/login";
  }

  if (to.meta.requiresAdmin && userRole.value !== "admin") {
    return "/unauthorized";
  }
});


export default router;
