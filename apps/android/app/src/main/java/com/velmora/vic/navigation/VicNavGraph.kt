package com.velmora.vic.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Memory
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.*
import com.velmora.vic.auth.AuthViewModel
import com.velmora.vic.auth.LoginScreen
import com.velmora.vic.chat.ChatScreen
import com.velmora.vic.chat.ChatViewModel
import com.velmora.vic.memories.MemoriesScreen
import com.velmora.vic.memories.MemoriesViewModel
import com.velmora.vic.settings.SettingsScreen
import com.velmora.vic.ui.theme.*

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Chat : Screen("chat", "DIRECTIVE", Icons.AutoMirrored.Filled.Chat)
    object Memories : Screen("memories", "MEMORY", Icons.Default.Memory)
    object Settings : Screen("settings", "TERMINAL", Icons.Default.Settings)
}

@Composable
fun VicNavGraph(
    navController: NavHostController = rememberNavController(),
    authViewModel: AuthViewModel = viewModel(),
    chatViewModel: ChatViewModel = viewModel(),
    memoriesViewModel: MemoriesViewModel = viewModel()
) {
    val authState by authViewModel.uiState.collectAsState()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val bottomNavItems = listOf(
        Screen.Chat,
        Screen.Memories,
        Screen.Settings
    )

    Scaffold(
        containerColor = VictorBackground,
        bottomBar = {
            if (currentRoute in bottomNavItems.map { it.route }) {
                NavigationBar(
                    containerColor = VictorSurface,
                    modifier = Modifier.border(1.dp, VictorBorder)
                ) {
                    bottomNavItems.forEach { screen ->
                        val isSelected = currentRoute == screen.route
                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = screen.icon,
                                    contentDescription = screen.title,
                                    modifier = Modifier.size(20.dp)
                                )
                            },
                            label = {
                                Text(
                                    text = screen.title,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    fontSize = 10.sp
                                )
                            },
                            selected = isSelected,
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = VictorCyan,
                                selectedTextColor = VictorCyan,
                                unselectedIconColor = VictorTextTertiary,
                                unselectedTextColor = VictorTextTertiary,
                                indicatorColor = VictorCyan.copy(alpha = 0.15f)
                            ),
                            onClick = {
                                if (currentRoute != screen.route) {
                                    navController.navigate(screen.route) {
                                        popUpTo(navController.graph.findStartDestination().id) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = if (authState.isAuthenticated) Screen.Chat.route else "login",
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("login") {
                LoginScreen(
                    viewModel = authViewModel,
                    onLoginSuccess = {
                        navController.navigate(Screen.Chat.route) {
                            popUpTo("login") { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Chat.route) {
                ChatScreen(viewModel = chatViewModel)
            }

            composable(Screen.Memories.route) {
                MemoriesScreen(viewModel = memoriesViewModel)
            }

            composable(Screen.Settings.route) {
                SettingsScreen(
                    authViewModel = authViewModel,
                    onSignedOut = {
                        navController.navigate("login") {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}
