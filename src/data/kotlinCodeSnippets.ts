export interface CodeFile {
  name: string;
  path: string;
  language: string;
  description: string;
  code: string;
}

export const KOTLIN_CODE_SNIPPETS: CodeFile[] = [
  {
    name: 'ExpandableSpeedDialFab.kt',
    path: 'app/src/main/java/com/example/librarymanagement/ui/components/ExpandableSpeedDialFab.kt',
    language: 'kotlin',
    description: 'Refactored TopAppBar with Hamburger Menu icon, ModalNavigationDrawer (Settings, Color Palette, Scan / QR Check-in, History & Shift Timings, Customize Seats), and cleaned-up "+ Actions" FAB Menu (Add Student & Toggle Theme only).',
    code: `package com.example.librarymanagement.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.librarymanagement.ui.MainViewModel
import com.example.librarymanagement.ui.theme.LakshayLibraryTheme
import kotlinx.coroutines.launch

/**
 * Scalable data model representing a single action in the expandable FAB menu or Navigation Drawer.
 */
data class FabActionItem(
    val id: String,
    val label: String,
    val subtitle: String,
    val icon: ImageVector,
    val isPrimary: Boolean = false,
    val onClick: () -> Unit
)

/**
 * Root entry composable binding MainViewModel's isDarkTheme StateFlow directly to
 * LakshayLibraryTheme (MaterialTheme) so clicking "Toggle Theme" inside the "+ Actions"
 * expandable FAB menu updates MaterialTheme.colorScheme across the entire app.
 */
@Composable
fun LakshayLibraryAppRoot(
    viewModel: MainViewModel,
    onOpenSettingsClick: () -> Unit,
    onAddStudentClick: () -> Unit,
    onChangeThemeClick: () -> Unit,
    onScanQrClick: () -> Unit,
    onHistoryAndShiftsClick: () -> Unit,
    onCustomizeSeatsClick: () -> Unit,
    onNotificationsClick: () -> Unit,
    content: @Composable (PaddingValues) -> Unit
) {
    val isDarkTheme by viewModel.isDarkTheme.collectAsState()

    LakshayLibraryTheme(darkTheme = isDarkTheme) {
        MainDashboardScaffold(
            isDarkTheme = isDarkTheme,
            onToggleThemeMode = { viewModel.toggleTheme() },
            onOpenSettingsClick = onOpenSettingsClick,
            onAddStudentClick = onAddStudentClick,
            onChangeThemeClick = onChangeThemeClick,
            onScanQrClick = onScanQrClick,
            onHistoryAndShiftsClick = onHistoryAndShiftsClick,
            onCustomizeSeatsClick = onCustomizeSeatsClick,
            onNotificationsClick = onNotificationsClick,
            content = content
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainDashboardScaffold(
    isDarkTheme: Boolean,
    onToggleThemeMode: () -> Unit,
    onOpenSettingsClick: () -> Unit,
    onAddStudentClick: () -> Unit,
    onChangeThemeClick: () -> Unit,
    onScanQrClick: () -> Unit,
    onHistoryAndShiftsClick: () -> Unit,
    onCustomizeSeatsClick: () -> Unit,
    onNotificationsClick: () -> Unit,
    content: @Composable (PaddingValues) -> Unit
) {
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val coroutineScope = rememberCoroutineScope()

    var isFabExpanded by remember { mutableStateOf(false) }
    var useBottomSheetMode by remember { mutableStateOf(false) }

    // 5 features moved to the left-sliding ModalNavigationDrawer
    val drawerItems = remember {
        listOf(
            FabActionItem(
                id = "settings",
                label = "Settings",
                subtitle = "App preferences & library configuration",
                icon = Icons.Default.Settings,
                onClick = onOpenSettingsClick
            ),
            FabActionItem(
                id = "color_palette",
                label = "Color Palette",
                subtitle = "Warm Sunset Amber & Slate presets",
                icon = Icons.Default.Palette,
                onClick = onChangeThemeClick
            ),
            FabActionItem(
                id = "scan_qr",
                label = "Scan / QR Check-in",
                subtitle = "Front-desk digital attendance scanner",
                icon = Icons.Default.QrCodeScanner,
                onClick = onScanQrClick
            ),
            FabActionItem(
                id = "history_shifts",
                label = "History & Shift Timings",
                subtitle = "Attendance logs, shifts & fee pricing",
                icon = Icons.Default.History,
                onClick = onHistoryAndShiftsClick
            ),
            FabActionItem(
                id = "customize_seats",
                label = "Customize Seats",
                subtitle = "Add or remove library desks & rows",
                icon = Icons.Default.EventSeat,
                onClick = onCustomizeSeatsClick
            )
        )
    }

    // Cleaned-up "+ Actions" FAB Menu: ONLY "Add Student" and "Toggle Theme"
    val fabActionItems = remember(isDarkTheme) {
        listOf(
            FabActionItem(
                id = "add_student",
                label = "Add Student",
                subtitle = "Register desk, shift & fee in Firestore",
                icon = Icons.Default.PersonAdd,
                isPrimary = true,
                onClick = onAddStudentClick
            ),
            FabActionItem(
                id = "toggle_theme",
                label = "Toggle Theme",
                subtitle = if (isDarkTheme) "Dark Mode active • Switch to Light" else "Light Mode active • Switch to Dark",
                icon = if (isDarkTheme) Icons.Default.LightMode else Icons.Default.DarkMode,
                onClick = onToggleThemeMode
            )
        )
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                // Drawer Header
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.primaryContainer)
                        .padding(horizontal = 20.dp, vertical = 24.dp)
                ) {
                    Text(
                        text = "Lakshay Library",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = "Tools & Library Configuration",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // 5 Clickable NavigationDrawerItem entries
                drawerItems.forEach { item ->
                    NavigationDrawerItem(
                        icon = {
                            Icon(
                                imageVector = item.icon,
                                contentDescription = item.label
                            )
                        },
                        label = {
                            Column {
                                Text(
                                    text = item.label,
                                    style = MaterialTheme.typography.bodyLarge,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = item.subtitle,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        },
                        selected = false,
                        onClick = {
                            coroutineScope.launch {
                                drawerState.close()
                            }
                            item.onClick()
                        },
                        modifier = Modifier.padding(NavigationDrawerItemDefaults.ItemPadding)
                    )
                }
            }
        }
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Scaffold(
                topBar = {
                    TopAppBar(
                        navigationIcon = {
                            // Hamburger menu icon on the far left of TopAppBar before title
                            IconButton(
                                onClick = {
                                    coroutineScope.launch {
                                        if (drawerState.isClosed) drawerState.open()
                                        else drawerState.close()
                                    }
                                }
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Menu,
                                    contentDescription = "Open Navigation Drawer"
                                )
                            }
                        },
                        title = {
                            Column {
                                Text(
                                    text = "Lakshay Library",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Desk & Fee Management",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                                )
                            }
                        },
                        actions = {
                            IconButton(onClick = onNotificationsClick) {
                                Icon(
                                    imageVector = Icons.Default.Notifications,
                                    contentDescription = "Fee Reminders"
                                )
                            }
                        },
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                            titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                            navigationIconContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    )
                },
                floatingActionButton = {
                    ExpandableSpeedDialFab(
                        isExpanded = isFabExpanded && !useBottomSheetMode,
                        onToggleExpand = { isFabExpanded = !isFabExpanded },
                        items = fabActionItems,
                        onSwitchToBottomSheet = { useBottomSheetMode = true }
                    )
                }
            ) { innerPadding ->
                content(innerPadding)
            }

            // Optional ModalBottomSheet mode for the same scalable FabActionItem list
            if (isFabExpanded && useBottomSheetMode) {
                SecondaryActionsBottomSheet(
                    items = fabActionItems,
                    onDismiss = { isFabExpanded = false },
                    onSwitchToSpeedDial = { useBottomSheetMode = false }
                )
            }
        }
    }
}

/**
 * Scalable Speed Dial FAB Container.
 * Uses a bounded LazyColumn so adding any number of future FabActionItem entries
 * scrolls smoothly without overflowing the screen.
 */
@Composable
fun ExpandableSpeedDialFab(
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
    items: List<FabActionItem>,
    onSwitchToBottomSheet: () -> Unit,
    modifier: Modifier = Modifier
) {
    val rotation by animateFloatAsState(
        targetValue = if (isExpanded) 45f else 0f,
        label = "FabIconRotation"
    )

    Column(
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = modifier
    ) {
        AnimatedVisibility(
            visible = isExpanded,
            enter = fadeIn() + expandVertically(expandFrom = Alignment.Bottom),
            exit = fadeOut() + shrinkVertically(shrinkTowards = Alignment.Bottom)
        ) {
            Surface(
                shape = RoundedCornerShape(20.dp),
                tonalElevation = 6.dp,
                shadowElevation = 12.dp,
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier
                    .widthIn(min = 260.dp, max = 310.dp)
                    .heightIn(max = 380.dp)
            ) {
                Column {
                    // Header bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Quick Actions",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold
                        )
                        TextButton(
                            onClick = onSwitchToBottomSheet,
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("Sheet View", style = MaterialTheme.typography.labelSmall)
                        }
                    }

                    // Scalable LazyColumn container for all sub-items
                    LazyColumn(
                        contentPadding = PaddingValues(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        items(items, key = { it.id }) { item ->
                            SpeedDialSubItemRow(
                                item = item,
                                onItemSelected = {
                                    onToggleExpand()
                                    item.onClick()
                                }
                            )
                        }
                    }
                }
            }
        }

        // Primary '+' / Close Extended Floating Action Button
        ExtendedFloatingActionButton(
            onClick = onToggleExpand,
            containerColor = if (isExpanded) {
                MaterialTheme.colorScheme.inverseSurface
            } else {
                MaterialTheme.colorScheme.primary
            },
            contentColor = if (isExpanded) {
                MaterialTheme.colorScheme.inverseOnSurface
            } else {
                MaterialTheme.colorScheme.onPrimary
            },
            icon = {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = if (isExpanded) "Close Menu" else "Open Actions",
                    modifier = Modifier.rotate(rotation)
                )
            },
            text = {
                Text(
                    text = if (isExpanded) "Close" else "Actions",
                    fontWeight = FontWeight.Bold
                )
            }
        )
    }
}

@Composable
private fun SpeedDialSubItemRow(
    item: FabActionItem,
    onItemSelected: () -> Unit
) {
    Surface(
        onClick = onItemSelected,
        shape = RoundedCornerShape(14.dp),
        color = if (item.isPrimary) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.65f)
        } else {
            Color.Transparent
        },
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (item.isPrimary) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.surfaceVariant
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = item.icon,
                    contentDescription = item.label,
                    tint = if (item.isPrimary) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp)
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.label,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = item.subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.outline,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SecondaryActionsBottomSheet(
    items: List<FabActionItem>,
    onDismiss: () -> Unit,
    onSwitchToSpeedDial: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 28.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Library Actions & Tools",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = onSwitchToSpeedDial) {
                    Text("Speed Dial View")
                }
            }

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.heightIn(max = 420.dp)
            ) {
                items(items, key = { it.id }) { item ->
                    SpeedDialSubItemRow(
                        item = item,
                        onItemSelected = {
                            onDismiss()
                            item.onClick()
                        }
                    )
                }
            }
        }
    }
}`
  },
  {
    name: 'AddStudentScreen.kt',
    path: 'app/src/main/java/com/example/librarymanagement/ui/AddStudentScreen.kt',
    language: 'kotlin',
    description: 'Jetpack Compose Composable function for adding a new student with full Material 3 inputs, date picker, shift dropdown, and Firestore save button.',
    code: `package com.example.librarymanagement.ui

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.librarymanagement.data.Student
import com.google.firebase.Timestamp
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddStudentScreen(
    onNavigateBack: () -> Unit,
    onStudentSaved: () -> Unit,
    viewModel: MainViewModel
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    // Form Field States
    var name by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }
    var seatNumber by remember { mutableStateOf("") }
    var shiftTimings by remember { mutableStateOf("08:00 AM - 02:00 PM (Morning)") }
    var monthlyFee by remember { mutableStateOf("1200") }
    var nextDueDateCalendar by remember {
        mutableStateOf(Calendar.getInstance().apply { add(Calendar.MONTH, 1) })
    }

    var isShiftDropdownExpanded by remember { mutableStateOf(false) }
    var showDatePickerDialog by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }

    // Validation Errors
    var nameError by remember { mutableStateOf(false) }
    var phoneError by remember { mutableStateOf(false) }
    var seatError by remember { mutableStateOf(false) }
    var feeError by remember { mutableStateOf(false) }

    val standardShifts = listOf(
        "08:00 AM - 02:00 PM (Morning)",
        "02:00 PM - 08:00 PM (Evening)",
        "08:00 AM - 08:00 PM (Full Day)",
        "08:00 PM - 02:00 AM (Night Owl)"
    )

    val dateFormatter = SimpleDateFormat("dd MMMM yyyy", Locale.getDefault())

    // Dynamic Material 3 text field colors adapting between Light Mode (dark/black text) and Dark Mode (white/light text)
    val dynamicTextFieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = MaterialTheme.colorScheme.onSurface,
        unfocusedTextColor = MaterialTheme.colorScheme.onSurface,
        disabledTextColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
        errorTextColor = MaterialTheme.colorScheme.onSurface,
        focusedContainerColor = MaterialTheme.colorScheme.surface,
        unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        cursorColor = MaterialTheme.colorScheme.primary,
        focusedLabelColor = MaterialTheme.colorScheme.primary,
        unfocusedLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
        focusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
        unfocusedPlaceholderColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
    )
    val dynamicInputTextStyle = LocalTextStyle.current.copy(
        color = MaterialTheme.colorScheme.onSurface
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Add New Student") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Student Registration Details",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary
            )

            // 1. Full Name
            OutlinedTextField(
                value = name,
                onValueChange = {
                    name = it
                    nameError = it.isBlank()
                },
                textStyle = dynamicInputTextStyle,
                colors = dynamicTextFieldColors,
                label = { Text("Full Name *") },
                placeholder = { Text("e.g. Aarav Sharma") },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                isError = nameError,
                supportingText = { if (nameError) Text("Name cannot be empty") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // 2. Phone Number
            OutlinedTextField(
                value = phoneNumber,
                onValueChange = {
                    phoneNumber = it
                    phoneError = it.length < 10
                },
                textStyle = dynamicInputTextStyle,
                colors = dynamicTextFieldColors,
                label = { Text("Phone Number (with Country Code) *") },
                placeholder = { Text("+91 9876543210") },
                leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                isError = phoneError,
                supportingText = { if (phoneError) Text("Enter a valid 10+ digit number") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // 3. Seat Number
            OutlinedTextField(
                value = seatNumber,
                onValueChange = {
                    seatNumber = it
                    seatError = it.isBlank()
                },
                textStyle = dynamicInputTextStyle,
                colors = dynamicTextFieldColors,
                label = { Text("Seat / Desk Number *") },
                placeholder = { Text("e.g. A-14 or Desk 08") },
                leadingIcon = { Icon(Icons.Default.Weekend, contentDescription = null) },
                isError = seatError,
                supportingText = { if (seatError) Text("Seat number is required") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // 4. Shift Timings (Exposed Dropdown Menu)
            ExposedDropdownMenuBox(
                expanded = isShiftDropdownExpanded,
                onExpandedChange = { isShiftDropdownExpanded = !isShiftDropdownExpanded }
            ) {
                OutlinedTextField(
                    value = shiftTimings,
                    onValueChange = {},
                    readOnly = true,
                    textStyle = dynamicInputTextStyle,
                    colors = dynamicTextFieldColors,
                    label = { Text("Shift Timings *") },
                    leadingIcon = { Icon(Icons.Default.Schedule, contentDescription = null) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isShiftDropdownExpanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth()
                )
                ExposedDropdownMenu(
                    expanded = isShiftDropdownExpanded,
                    onDismissRequest = { isShiftDropdownExpanded = false }
                ) {
                    standardShifts.forEach { shift ->
                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = shift,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            },
                            onClick = {
                                shiftTimings = shift
                                isShiftDropdownExpanded = false
                            }
                        )
                    }
                }
            }

            // 5. Monthly Fee Amount
            OutlinedTextField(
                value = monthlyFee,
                onValueChange = {
                    monthlyFee = it
                    feeError = (it.toDoubleOrNull() ?: 0.0) <= 0.0
                },
                textStyle = dynamicInputTextStyle,
                colors = dynamicTextFieldColors,
                label = { Text("Monthly Fee Amount (₹) *") },
                placeholder = { Text("1200") },
                leadingIcon = { Icon(Icons.Default.CurrencyRupee, contentDescription = null) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                isError = feeError,
                supportingText = { if (feeError) Text("Enter a valid amount > 0") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            // 6. Next Fee Due Date Picker Trigger
            OutlinedTextField(
                value = dateFormatter.format(nextDueDateCalendar.time),
                onValueChange = {},
                readOnly = true,
                textStyle = dynamicInputTextStyle,
                colors = dynamicTextFieldColors,
                label = { Text("Next Fee Due Date *") },
                leadingIcon = { Icon(Icons.Default.CalendarToday, contentDescription = null) },
                trailingIcon = {
                    IconButton(onClick = { showDatePickerDialog = true }) {
                        Icon(Icons.Default.EditCalendar, contentDescription = "Pick Date")
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { showDatePickerDialog = true }
            )

            Spacer(modifier = Modifier.height(8.dp))

            // 7. Save to Firestore Button
            Button(
                onClick = {
                    val feeNum = monthlyFee.toDoubleOrNull() ?: 0.0
                    val isValid = name.isNotBlank() && phoneNumber.isNotBlank() &&
                            seatNumber.isNotBlank() && feeNum > 0.0

                    if (!isValid) {
                        nameError = name.isBlank()
                        phoneError = phoneNumber.isBlank()
                        seatError = seatNumber.isBlank()
                        feeError = feeNum <= 0.0
                        Toast.makeText(context, "Please complete all required fields", Toast.LENGTH_SHORT).show()
                        return@Button
                    }

                    isSaving = true
                    val newStudent = Student(
                        name = name.trim(),
                        phoneNumber = phoneNumber.trim(),
                        seatNumber = seatNumber.trim().uppercase(),
                        shiftTimings = shiftTimings,
                        monthlyFee = feeNum,
                        nextFeeDueDate = Timestamp(nextDueDateCalendar.time)
                    )

                    viewModel.saveStudentToFirestore(
                        student = newStudent,
                        onSuccess = {
                            isSaving = false
                            Toast.makeText(context, "Student added to Firestore!", Toast.LENGTH_SHORT).show()
                            onStudentSaved()
                        },
                        onError = { error ->
                            isSaving = false
                            Toast.makeText(context, "Error saving: \${error.localizedMessage}", Toast.LENGTH_LONG).show()
                        }
                    )
                },
                enabled = !isSaving,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = MaterialTheme.shapes.medium
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.5.dp
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("Saving to Firestore...")
                } else {
                    Icon(Icons.Default.CloudUpload, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Save Student to Firestore")
                }
            }
        }

        // Material 3 Date Picker Dialog
        if (showDatePickerDialog) {
            val datePickerState = rememberDatePickerState(
                initialSelectedDateMillis = nextDueDateCalendar.timeInMillis
            )
            DatePickerDialog(
                onDismissRequest = { showDatePickerDialog = false },
                confirmButton = {
                    TextButton(onClick = {
                        datePickerState.selectedDateMillis?.let { millis ->
                            nextDueDateCalendar = Calendar.getInstance().apply {
                                timeInMillis = millis
                            }
                        }
                        showDatePickerDialog = false
                    }) {
                        Text("Select")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDatePickerDialog = false }) {
                        Text("Cancel")
                    }
                }
            ) {
                DatePicker(state = datePickerState)
            }
        }
    }
}`
  },
  {
    name: 'StudentDetailScreen.kt',
    path: 'app/src/main/java/com/example/librarymanagement/ui/StudentDetailScreen.kt',
    language: 'kotlin',
    description: 'Detailed View for each student displaying their seat, shift, and complete payment history queried directly from the Firestore "PaymentHistory" sub-collection.',
    code: `package com.example.librarymanagement.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.example.librarymanagement.data.PaymentRecord
import com.example.librarymanagement.data.Student
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentDetailScreen(
    studentId: String,
    viewModel: MainViewModel,
    onNavigateBack: () -> Unit
) {
    val student by viewModel.getStudentById(studentId).collectAsState(initial = null)
    val paymentHistory by viewModel.getPaymentHistoryFlow(studentId).collectAsState(initial = emptyList())
    val isLoadingPayments by viewModel.isLoadingPayments.collectAsState()

    val dateFormatter = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())
    val dueDateFormatter = SimpleDateFormat("dd MMMM yyyy", Locale.getDefault())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(student?.name ?: "Student Profile") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { innerPadding ->
        if (student == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            val currentStudent = student!!
            LazyColumn(
                modifier = Modifier
                    .padding(innerPadding)
                    .fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header Student Info Card
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant
                        )
                    ) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = currentStudent.name,
                                    style = MaterialTheme.typography.headlineSmall
                                )
                                SuggestionChip(
                                    onClick = {},
                                    label = { Text("Seat \${currentStudent.seatNumber}") },
                                    icon = { Icon(Icons.Default.Weekend, contentDescription = null, modifier = Modifier.size(16.dp)) }
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))
                            Divider()
                            Spacer(modifier = Modifier.height(10.dp))

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Phone, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(currentStudent.phoneNumber, style = MaterialTheme.typography.bodyMedium)
                            }
                            Spacer(modifier = Modifier.height(6.dp))

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Schedule, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(currentStudent.shiftTimings, style = MaterialTheme.typography.bodyMedium)
                            }
                            Spacer(modifier = Modifier.height(6.dp))

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.CurrencyRupee, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Monthly Fee: ₹\${currentStudent.monthlyFee}", style = MaterialTheme.typography.bodyMedium)
                            }
                            Spacer(modifier = Modifier.height(6.dp))

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Event, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "Next Fee Due: \${dueDateFormatter.format(currentStudent.nextFeeDueDate.toDate())}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }

                // Section Title: Sub-collection Payment History
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Payment History Sub-Collection",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Badge {
                            Text("\${paymentHistory.size} records")
                        }
                    }
                }

                if (isLoadingPayments) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(32.dp))
                        }
                    }
                } else if (paymentHistory.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    Icons.Default.ReceiptLong,
                                    contentDescription = null,
                                    modifier = Modifier.size(48.dp),
                                    tint = MaterialTheme.colorScheme.outline
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("No payment history records found in Firestore.")
                            }
                        }
                    }
                } else {
                    items(paymentHistory, key = { it.id }) { record ->
                        PaymentHistoryItemCard(record = record, dateFormatter = dateFormatter)
                    }
                }
            }
        }
    }
}

@Composable
fun PaymentHistoryItemCard(record: PaymentRecord, dateFormatter: SimpleDateFormat) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = "Paid",
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "₹\${record.amountPaid}",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = dateFormatter.format(record.paymentDate.toDate()),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (record.id.isNotBlank()) {
                    Text(
                        text = "Receipt ID: \${record.id}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline
                    )
                }
            }
        }
    }
}`
  },
  {
    name: 'StudentRepository.kt',
    path: 'app/src/main/java/com/example/librarymanagement/data/StudentRepository.kt',
    language: 'kotlin',
    description: 'Cloud Firestore repository implementing addStudent, sub-collection queries, batch transactions, and live snapshot listeners.',
    code: `package com.example.librarymanagement.data

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Calendar

class StudentRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    private val studentsCollection = firestore.collection("students")

    // 1. Add new student to Firestore
    suspend fun addStudent(student: Student): String {
        val documentRef = studentsCollection.document()
        val studentData = student.copy(id = documentRef.id)
        documentRef.set(studentData).await()
        return documentRef.id
    }

    // 2. Real-time stream of all students
    fun getStudentsFlow(): Flow<List<Student>> = callbackFlow {
        val listenerRegistration = studentsCollection
            .orderBy("nextFeeDueDate", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                val students = snapshot?.toObjects(Student::class.java) ?: emptyList()
                trySend(students)
            }
        awaitClose { listenerRegistration.remove() }
    }

    // 3. Sub-collection query: Fetch PaymentHistory for a specific student
    fun getPaymentHistoryFlow(studentId: String): Flow<List<PaymentRecord>> = callbackFlow {
        val paymentSubCollection = studentsCollection
            .document(studentId)
            .collection("PaymentHistory")
            .orderBy("paymentDate", Query.Direction.DESCENDING)

        val listener = paymentSubCollection.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val records = snapshot?.toObjects(PaymentRecord::class.java) ?: emptyList()
            trySend(records)
        }
        awaitClose { listener.remove() }
    }

    // 4. Atomic Batch: Log Payment record & advance Next Fee Due Date by 1 month
    suspend fun markStudentAsPaid(student: Student) {
        val studentRef = studentsCollection.document(student.id)
        val paymentSubCollectionRef = studentRef.collection("PaymentHistory").document()

        // Advance date forward by 1 month
        val calendar = Calendar.getInstance().apply {
            time = student.nextFeeDueDate.toDate()
            add(Calendar.MONTH, 1)
        }
        val advancedDate = Timestamp(calendar.time)

        val paymentRecord = hashMapOf(
            "paymentDate" to Timestamp.now(),
            "amountPaid" to student.monthlyFee
        )

        firestore.runBatch { batch ->
            // Step 1: Insert into PaymentHistory sub-collection
            batch.set(paymentSubCollectionRef, paymentRecord)
            // Step 2: Advance nextFeeDueDate in parent document
            batch.update(studentRef, "nextFeeDueDate", advancedDate)
        }.await()
    }
}`
  },
  {
    name: 'MainViewModel.kt',
    path: 'app/src/main/java/com/example/librarymanagement/ui/MainViewModel.kt',
    language: 'kotlin',
    description: 'Jetpack Compose ViewModel managing tab navigation, automated overdue-priority sorting on app launch, 30-day Total Revenue Projected calculation, and live Firestore flows.',
    code: `package com.example.librarymanagement.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.librarymanagement.data.PaymentRecord
import com.example.librarymanagement.data.Student
import com.example.librarymanagement.data.StudentRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

enum class TabScreen(val title: String) {
    ALL("All Students"),
    DUE_SOON("Due Soon"),
    OVERDUE("Overdue"),
    ANALYTICS("Analytics")
}

enum class StudentSortRule {
    OVERDUE_PRIORITY, // Default upon launch: most overdue payments prioritized to top
    NAME_ASC,
    DUE_DATE_ASC,
    SEAT_ASC
}

class MainViewModel(
    private val repository: StudentRepository = StudentRepository()
) : ViewModel() {

    // Global MaterialTheme Dark/Light mode state toggled from the "+ Actions" FAB menu
    private val _isDarkTheme = MutableStateFlow(false)
    val isDarkTheme: StateFlow<Boolean> = _isDarkTheme.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedTab = MutableStateFlow(TabScreen.ALL)
    val selectedTab: StateFlow<TabScreen> = _selectedTab.asStateFlow()

    // Automated sorting rule defaulting to OVERDUE_PRIORITY upon app launch
    private val _sortRule = MutableStateFlow(StudentSortRule.OVERDUE_PRIORITY)
    val sortRule: StateFlow<StudentSortRule> = _sortRule.asStateFlow()

    private val _allStudents = MutableStateFlow<List<Student>>(emptyList())
    val isLoadingPayments = MutableStateFlow(false)

    // Total Revenue Projected for the next 30 days based on individual student fee due dates
    val totalRevenueProjectedNext30Days: StateFlow<Double> = _allStudents.map { students ->
        val today = LocalDate.now()
        val windowEnd = today.plusDays(30)
        students.filter { student ->
            val dueDate = student.nextFeeDueDate.toDate().toInstant()
                .atZone(ZoneId.systemDefault()).toLocalDate()
            !dueDate.isAfter(windowEnd) // Includes overdue recovery + renewals due within 0..30 days
        }.sumOf { it.monthlyFee }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    // Evaluated list based on active tab, search query, and automated overdue-first sorting rule
    val displayedStudents: StateFlow<List<Student>> = combine(
        _allStudents,
        _searchQuery,
        _selectedTab,
        _sortRule
    ) { students, query, tab, sortRule ->
        val today = LocalDate.now()

        val tabFiltered = when (tab) {
            TabScreen.ALL, TabScreen.ANALYTICS -> students
            TabScreen.DUE_SOON -> students.filter {
                val dueDate = it.nextFeeDueDate.toDate().toInstant()
                    .atZone(ZoneId.systemDefault()).toLocalDate()
                !dueDate.isBefore(today) && !dueDate.isAfter(today.plusDays(3))
            }
            TabScreen.OVERDUE -> students.filter {
                val dueDate = it.nextFeeDueDate.toDate().toInstant()
                    .atZone(ZoneId.systemDefault()).toLocalDate()
                dueDate.isBefore(today)
            }
        }

        val queryFiltered = if (query.isBlank()) tabFiltered
        else tabFiltered.filter {
            it.name.contains(query, ignoreCase = true) ||
            it.seatNumber.contains(query, ignoreCase = true) ||
            it.phoneNumber.contains(query)
        }

        when (sortRule) {
            StudentSortRule.OVERDUE_PRIORITY -> queryFiltered.sortedWith(
                compareBy<Student> { student ->
                    val dueDate = student.nextFeeDueDate.toDate().toInstant()
                        .atZone(ZoneId.systemDefault()).toLocalDate()
                    val daysDiff = ChronoUnit.DAYS.between(today, dueDate)
                    daysDiff >= 0 // false (overdue) comes before true (non-overdue)
                }.thenBy { student ->
                    val dueDate = student.nextFeeDueDate.toDate().toInstant()
                        .atZone(ZoneId.systemDefault()).toLocalDate()
                    ChronoUnit.DAYS.between(today, dueDate) // Most negative (most overdue) first
                }.thenByDescending { it.monthlyFee }
            )
            StudentSortRule.NAME_ASC -> queryFiltered.sortedBy { it.name.lowercase() }
            StudentSortRule.DUE_DATE_ASC -> queryFiltered.sortedBy { it.nextFeeDueDate.seconds }
            StudentSortRule.SEAT_ASC -> queryFiltered.sortedBy { it.seatNumber }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        viewModelScope.launch {
            repository.getStudentsFlow().collect { students ->
                _allStudents.value = students
            }
        }
    }

    fun toggleTheme() {
        _isDarkTheme.update { !it }
    }

    fun setDarkTheme(enabled: Boolean) {
        _isDarkTheme.value = enabled
    }

    fun onSearchQueryChanged(newQuery: String) {
        _searchQuery.value = newQuery
    }

    fun onTabSelected(tab: TabScreen) {
        _selectedTab.value = tab
    }

    fun saveStudentToFirestore(
        student: Student,
        onSuccess: () -> Unit,
        onError: (Exception) -> Unit
    ) {
        viewModelScope.launch {
            try {
                repository.addStudent(student)
                onSuccess()
            } catch (e: Exception) {
                onError(e)
            }
        }
    }

    fun confirmPayment(student: Student) {
        viewModelScope.launch {
            repository.markStudentAsPaid(student)
        }
    }

    fun getStudentById(id: String): Flow<Student?> = _allStudents.map { list ->
        list.find { it.id == id }
    }

    fun getPaymentHistoryFlow(studentId: String): Flow<List<PaymentRecord>> {
        return repository.getPaymentHistoryFlow(studentId)
    }
}`
  },
  {
    name: 'FeeReminderWorker.kt',
    path: 'app/src/main/java/com/example/librarymanagement/worker/FeeReminderWorker.kt',
    language: 'kotlin',
    description: 'Periodic WorkManager worker running once daily to alert staff for students whose fee is due in exactly 3 days.',
    code: `package com.example.librarymanagement.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.librarymanagement.data.Student
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import java.time.LocalDate
import java.time.ZoneId

class FeeReminderWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val firestore = FirebaseFirestore.getInstance()
        val targetDueDate = LocalDate.now().plusDays(3)

        return try {
            val snapshot = firestore.collection("students").get().await()
            val students = snapshot.toObjects(Student::class.java)

            // Filter students whose fee is due exactly 3 days from now
            val matchingStudents = students.filter { student ->
                val dueLocalDate = student.nextFeeDueDate.toDate()
                    .toInstant()
                    .atZone(ZoneId.systemDefault())
                    .toLocalDate()
                dueLocalDate == targetDueDate
            }

            if (matchingStudents.isNotEmpty()) {
                sendNotification(matchingStudents)
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun sendNotification(students: List<Student>) {
        val channelId = "fee_reminders_channel"
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Library Fee Reminders",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        val names = students.take(3).joinToString { it.name }
        val content = if (students.size > 3) {
            "$names and \${students.size - 3} others have fees due in 3 days."
        } else {
            "Fees due in 3 days for: $names."
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Fee Reminder (\${students.size} Due Soon)")
            .setContentText(content)
            .setStyle(NotificationCompat.BigTextStyle().bigText(content))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(1001, notification)
    }
}`
  },
  {
    name: 'StudentQrCodeScreen.kt',
    path: 'app/src/main/java/com/example/librarymanagement/ui/StudentQrCodeScreen.kt',
    language: 'kotlin',
    description: 'Jetpack Compose Composable generating unique student desk pass and QR code using ZXing and Bitmap rendering for front-desk check-in.',
    code: `package com.example.librarymanagement.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import com.example.librarymanagement.data.Student
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentQrCodeScreen(
    student: Student,
    onNavigateBack: () -> Unit
) {
    val qrBitmap = remember(student.id) {
        val payload = JSONObject().apply {
            put("app", "lakshay_library")
            put("studentId", student.id)
            put("name", student.name)
            put("seatNumber", student.seatNumber)
        }.toString()
        generateQrBitmap(payload, 512)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Desk QR Pass") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(text = student.name, style = MaterialTheme.typography.headlineSmall)
                    Text(text = "Seat \${student.seatNumber} • \${student.shiftTimings}", style = MaterialTheme.typography.bodyMedium)

                    Spacer(modifier = Modifier.height(20.dp))

                    qrBitmap?.let { bmp ->
                        Image(
                            bitmap = bmp.asImageBitmap(),
                            contentDescription = "Student QR Pass",
                            modifier = Modifier
                                .size(220.dp)
                                .background(Color.White, RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Text(text = "Present at library front-desk scanner", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

private fun generateQrBitmap(content: String, size: Int): Bitmap? {
    return try {
        val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size)
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(x, y, if (matrix.get(x, y)) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
            }
        }
        bitmap
    } catch (e: Exception) {
        null
    }
}`
  },
  {
    name: 'QrScannerScreen.kt',
    path: 'app/src/main/java/com/example/librarymanagement/ui/QrScannerScreen.kt',
    language: 'kotlin',
    description: 'Jetpack Compose ML Kit + CameraX scanner view that reads student QR passes and updates lastCheckIn in Firestore.',
    code: `package com.example.librarymanagement.ui

import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import org.json.JSONObject

@Composable
fun QrScannerScreen(
    onQrScanned: (studentId: String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    AndroidView(
        factory = { ctx ->
            val previewView = PreviewView(ctx)
            val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

            cameraProviderFuture.addListener({
                val cameraProvider = cameraProviderFuture.get()
                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }

                val imageAnalysis = ImageAnalysis.Builder()
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()

                imageAnalysis.setAnalyzer(ContextCompat.getMainExecutor(ctx)) { imageProxy ->
                    val mediaImage = imageProxy.image
                    if (mediaImage != null) {
                        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                        BarcodeScanning.getClient().process(image)
                            .addOnSuccessListener { barcodes ->
                                for (barcode in barcodes) {
                                    barcode.rawValue?.let { jsonStr ->
                                        try {
                                            val obj = JSONObject(jsonStr)
                                            val studentId = obj.optString("studentId")
                                            if (studentId.isNotBlank()) {
                                                onQrScanned(studentId)
                                            }
                                        } catch (e: Exception) {
                                            // Handle raw ID
                                            onQrScanned(jsonStr)
                                        }
                                    }
                                }
                            }
                            .addOnCompleteListener { imageProxy.close() }
                    } else {
                        imageProxy.close()
                    }
                }

                cameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalysis
                )
            }, ContextCompat.getMainExecutor(ctx))

            previewView
        },
        modifier = Modifier.fillMaxSize()
    )
}`
  },
  {
    name: 'firestore.rules',
    path: 'firestore.rules',
    language: 'javascript',
    description: 'Production Cloud Firestore security rules with support for student records and the PaymentHistory sub-collection.',
    code: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Authenticated library staff can read and manage all student profiles
    match /students/{studentId} {
      allow read, write: if request.auth != null;
      
      // Sub-collection PaymentHistory: stores all past payments per student
      match /PaymentHistory/{paymentId} {
        allow read, write: if request.auth != null;
      }
    }

    // DailyAttendance collection: stores individual student daily check-in logs
    match /DailyAttendance/{attendanceId} {
      allow read, write: if request.auth != null;
    }
  }
}`
  },
  {
    name: 'DailyDatabaseBackupWorker.kt',
    path: 'app/src/main/java/com/example/librarymanagement/worker/DailyDatabaseBackupWorker.kt',
    language: 'kotlin',
    description: 'Recurring 24-hour WorkManager CoroutineWorker that exports a JSON snapshot of the Firestore student database and PaymentHistory sub-collections to local device storage daily.',
    code: `package com.example.librarymanagement.worker

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.example.librarymanagement.data.PaymentRecord
import com.example.librarymanagement.data.Student
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.time.Instant
import java.util.concurrent.TimeUnit

class DailyDatabaseBackupWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val firestore = FirebaseFirestore.getInstance()
        val todayStr = LocalDate.now().toString()

        return try {
            val studentsSnapshot = firestore.collection("students").get().await()
            val students = studentsSnapshot.toObjects(Student::class.java)

            val studentsJsonArray = JSONArray()
            var totalPaymentRecords = 0

            for (student in students) {
                val paymentDocs = firestore.collection("students")
                    .document(student.id)
                    .collection("PaymentHistory")
                    .get()
                    .await()
                val payments = paymentDocs.toObjects(PaymentRecord::class.java)
                totalPaymentRecords += payments.size

                val paymentArray = JSONArray()
                payments.forEach { record ->
                    paymentArray.put(
                        JSONObject().apply {
                            put("id", record.id)
                            put("amountPaid", record.amountPaid)
                            put("paymentDate", record.paymentDate.toDate().toInstant().toString())
                        }
                    )
                }

                studentsJsonArray.put(
                    JSONObject().apply {
                        put("id", student.id)
                        put("name", student.name)
                        put("phoneNumber", student.phoneNumber)
                        put("seatNumber", student.seatNumber)
                        put("shiftTimings", student.shiftTimings)
                        put("monthlyFee", student.monthlyFee)
                        put("nextFeeDueDate", student.nextFeeDueDate.toDate().toInstant().toString())
                        put("PaymentHistory", paymentArray)
                    }
                )
            }

            val rootBackupJson = JSONObject().apply {
                put("schemaVersion", "1.0")
                put("application", "Lakshay Library Management App (LibTrack)")
                put("workerClass", "DailyDatabaseBackupWorker")
                put("exportedAt", Instant.now().toString())
                put("totalStudents", students.size)
                put("totalPaymentRecords", totalPaymentRecords)
                put("students", studentsJsonArray)
            }

            // Write formatted JSON backup to app-specific local device storage
            val backupDir = File(context.getExternalFilesDir(null), "backups").apply {
                if (!exists()) mkdirs()
            }
            val backupFile = File(backupDir, "Lakshay_Library_Firestore_Backup_\$todayStr.json")
            backupFile.writeText(rootBackupJson.toString(2), Charsets.UTF_8)

            sendBackupSuccessNotification(backupFile.name, students.size, backupFile.length())
            Result.success(
                workDataOf(
                    "backupFilePath" to backupFile.absolutePath,
                    "studentCount" to students.size
                )
            )
        } catch (e: Exception) {
            Result.retry()
        }
    }

    private fun sendBackupSuccessNotification(fileName: String, count: Int, bytes: Long) {
        val channelId = "daily_backup_channel"
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Daily JSON Database Backups",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            manager.createNotificationChannel(channel)
        }

        val kbSize = String.format("%.1f KB", bytes / 1024.0)
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("Daily Firestore JSON Backup Saved")
            .setContentText("\$fileName (\$count students • \$kbSize) exported to local storage.")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        manager.notify(1002, notification)
    }

    companion object {
        private const val UNIQUE_WORK_NAME = "LakshayLibraryDailyJsonBackupWork"

        fun scheduleDailyDatabaseBackup(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresStorageNotLow(true)
                .build()

            val dailyBackupRequest = PeriodicWorkRequestBuilder<DailyDatabaseBackupWorker>(
                24, TimeUnit.HOURS
            )
                .setConstraints(constraints)
                .addTag("firestore_daily_json_backup")
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                dailyBackupRequest
            )
        }
    }
}`
  }
];

