package com.android.altovoltajerunningteam

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.github.mikephil.charting.charts.BarChart
import com.github.mikephil.charting.components.Description
import com.github.mikephil.charting.data.BarData
import com.github.mikephil.charting.data.BarDataSet
import com.github.mikephil.charting.data.BarEntry
import okhttp3.Call
import okhttp3.Callback
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {
    private lateinit var messageAdapter: MessageAdapter
    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore
    private lateinit var userAdapter: UserAdapter
    private lateinit var messageList: MutableList<Message>
    private lateinit var messageEditText: EditText
    private lateinit var sendMessageButton: Button
    private lateinit var receivedMessageTextView: TextView
    private lateinit var weeklyBarChart: BarChart
    private lateinit var monthlyBarChart: BarChart

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Inicializar los gráficos de barras
        weeklyBarChart = findViewById(R.id.weeklyBarChart)
        monthlyBarChart = findViewById(R.id.monthlyBarChart)

// Configurar el LinearLayout para lanzar la aplicación de Strava
        val stravaLinearLayout = findViewById<LinearLayout>(R.id.activitiesLayout)
        stravaLinearLayout.setOnClickListener {
            val packageName = "com.strava"
            val isStravaInstalled = isAppInstalled(packageName)
            val stravaUrl = "https://www.strava.com/"

            if (isStravaInstalled) {
                // Si Strava está instalado, lanzar la aplicación
                val intent = packageManager.getLaunchIntentForPackage(packageName)
                startActivity(intent)
            } else {
                // Si Strava no está instalado, abrir la URL en el navegador web
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(stravaUrl))
                startActivity(browserIntent)
            }
        }

        // Inicializar Firebase Auth
        auth = FirebaseAuth.getInstance()
        db = FirebaseFirestore.getInstance()

        // Inicializar los componentes de la UI
        messageEditText = findViewById(R.id.messageEditText)
        sendMessageButton = findViewById(R.id.buttonSendMessage)
        receivedMessageTextView = findViewById(R.id.receivedMessageTextView)

        // Configurar el Toolbar como ActionBar
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)

        // Desactivar el título predeterminado del Toolbar
        supportActionBar?.setDisplayShowTitleEnabled(false)

        // Configurar el icono de la aplicación
        val appIcon = findViewById<ImageView>(R.id.app_icon)
        appIcon.setImageResource(R.drawable.ic_launcher) // Cambia "ic_launcher" por el nombre de tu icono

        // Configurar el ícono de Strava
        val stravaIcon = findViewById<ImageView>(R.id.strava_icon)
        stravaIcon.setOnClickListener {
            val intent = Intent(this, StravaAuthActivity::class.java)
            startActivity(intent)
        }

        // Obtener el token de acceso y refrescar si es necesario
        refreshStravaTokenIfNeeded(this) { accessToken ->
            if (accessToken != null) {
                runOnUiThread {
                    Toast.makeText(this, "Autenticación completada", Toast.LENGTH_SHORT).show()
                }
                //fetchLatestStravaActivity()
                val stravaAuthActivity = StravaAuthActivity()
                stravaAuthActivity.fetchActivitiesForLastDay(this) { activities ->
                    runOnUiThread {
                        val activitiesLayout = findViewById<LinearLayout>(R.id.activitiesLayout)
                        activitiesLayout.removeAllViews()

                        activities?.forEach { activity ->
                            val activityTextView = TextView(this)
                            val pace = calculatePace(activity.movingTime, activity.distance)
                            val activityTime = formatActivityTime(activity.startDate)
                            activityTextView.text = "${activity.name} - $activityTime\nDistancia: ${"%.2f km".format(activity.distance / 1000.0)}\nTiempo: ${activity.movingTime / 60} min\nRitmo: $pace min/km"
                            activityTextView.setBackgroundResource(R.drawable.background_rounded)
                            activityTextView.setTextColor(Color.parseColor("#ff6600"))
                            activityTextView.setPadding(16, 16, 16, 16)

                            val layoutParams = LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT,
                                LinearLayout.LayoutParams.WRAP_CONTENT
                            )
                            layoutParams.setMargins(0, 16, 0, 16)
                            activityTextView.layoutParams = layoutParams

                            activitiesLayout.addView(activityTextView)
                        }
                    }
                }
                fetchAllStravaActivities()
            } else {
                // Si no hay token, redirigir a la actividad de autenticación
                /*val intent = Intent(this, StravaAuthActivity::class.java)
                startActivity(intent)
                finish()*/
            }
        }

        // Configurar el nombre del usuario
        val userNameTextView = findViewById<TextView>(R.id.user_name)
        val currentUser = auth.currentUser
        if (currentUser != null) {
            userNameTextView.text = currentUser.email
            // El usuario está autenticado, puedes continuar con la lógica de tu aplicación
            Log.d("MainActivity", "Usuario autenticado: ${currentUser.email}")
            setupUI(currentUser.email)
        } else {
            // Si no hay un usuario autenticado, lanzar LoginActivity
            val intent = Intent(this, LoginActivity::class.java)
            startActivity(intent)
            finish() // Finalizar la MainActivity para que no esté en el back stack
        }
    }

    private fun calculatePace(movingTime: Int, distance: Double): String {
        val pace = movingTime / (distance / 1000.0)
        val minutes = (pace / 60).toInt()
        val seconds = (pace % 60).toInt()
        return String.format("%d:%02d", minutes, seconds)
    }

    private fun formatActivityTime(startDate: String): String {
        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
        //dateFormat.timeZone = TimeZone.getTimeZone("UTC")
        val date = dateFormat.parse(startDate)

        val outputFormat = SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault())
        //outputFormat.timeZone = TimeZone.getTimeZone("America/Argentina/Buenos_Aires")
        return outputFormat.format(date)
    }

    private fun refreshStravaTokenIfNeeded(context: Context, callback: (String?) -> Unit) {
        val sharedPreferences = context.getSharedPreferences("StravaAuth", Context.MODE_PRIVATE)
        val accessToken = sharedPreferences.getString("access_token", null)
        val refreshToken = sharedPreferences.getString("refresh_token", null)
        val expiresAt = sharedPreferences.getLong("expires_at", 0)
        val currentTime = System.currentTimeMillis() / 1000

        if (accessToken != null && refreshToken != null) {
            if (currentTime >= expiresAt) {
                // Token ha caducado, refrescar
                refreshAccessToken(context, refreshToken, callback)
            } else {
                // Token aún es válido
                callback(accessToken)
            }
        } else {
            // No hay token disponible
            callback(null)
        }
    }

    private fun refreshAccessToken(context: Context, refreshToken: String, callback: (String?) -> Unit) {
        val client = OkHttpClient()
        val requestBody = FormBody.Builder()
            .add("client_id", "127124")
            .add("client_secret", "50825ee5414cc703024485e972996e8a1fd8131b")
            .add("refresh_token", refreshToken)
            .add("grant_type", "refresh_token")
            .build()

        val request = Request.Builder()
            .url("https://www.strava.com/oauth/token")
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    callback(null)
                }
            }

            override fun onResponse(call: Call, response: Response) {
                response.body?.string()?.let {
                    val json = JSONObject(it)
                    val newAccessToken = json.getString("access_token")
                    val newRefreshToken = json.getString("refresh_token")
                    val newExpiresAt = json.getLong("expires_at")

                    saveTokens(context, newAccessToken, newRefreshToken, newExpiresAt)

                    runOnUiThread {
                        callback(newAccessToken)
                    }
                } ?: run {
                    runOnUiThread {
                        callback(null)
                    }
                }
            }
        })
    }

    private fun saveTokens(context: Context, accessToken: String, refreshToken: String, expiresAt: Long) {
        val sharedPreferences = context.getSharedPreferences("StravaAuth", Context.MODE_PRIVATE)
        with(sharedPreferences.edit()) {
            putString("access_token", accessToken)
            putString("refresh_token", refreshToken)
            putLong("expires_at", expiresAt)
            apply()
        }
    }

    fun isAppInstalled(packageName: String): Boolean {
        return try {
            packageManager.getPackageInfo(packageName, PackageManager.GET_ACTIVITIES)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    private fun updateCharts() {
        val sharedPreferences = getSharedPreferences("StravaAuth", Context.MODE_PRIVATE)
        val accessToken = sharedPreferences.getString("access_token", null)

        if (accessToken != null) {
            val client = OkHttpClient()
            val request = Request.Builder()
                .url("https://www.strava.com/api/v3/athlete/activities")
                .header("Authorization", "Bearer $accessToken")
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.e("MainActivity", "Error al obtener actividades de Strava", e)
                }

                override fun onResponse(call: Call, response: Response) {
                    val responseBody = response.body?.string()
                    if (!response.isSuccessful || responseBody == null) {
                        Log.e("MainActivity", "Error en la respuesta al obtener actividades de Strava")
                        return
                    }

                    try {
                        val jsonArray = JSONArray(responseBody)
                        val activities = mutableListOf<JSONObject>()
                        for (i in 0 until jsonArray.length()) {
                            activities.add(jsonArray.getJSONObject(i))
                        }

                        val (weeklyDistance, weeklyStartDate, weeklyEndDate) = calculateWeeklyDistance(activities)
                        val (monthlyDistance, monthlyStartDate, monthlyEndDate) = calculateMonthlyDistance(activities)

                        runOnUiThread {
                            updateBarChart(weeklyBarChart, weeklyDistance, "Distancia Semanal", weeklyStartDate, weeklyEndDate)
                            updateBarChart(monthlyBarChart, monthlyDistance, "Distancia Mensual", monthlyStartDate, monthlyEndDate)
                        }
                    } catch (e: JSONException) {
                        Log.e("MainActivity", "Error al procesar la respuesta JSON", e)
                    }
                }
            })
        }
    }

    private fun updateBarChart(barChart: BarChart, distances: Map<Int, Float>, label: String, startDate: String, endDate: String) {
        val entries = mutableListOf<BarEntry>()
        for ((key, value) in distances) {
            entries.add(BarEntry(key.toFloat(), value))
        }

        val dataSet = BarDataSet(entries, "$label ($startDate - $endDate)").apply {
            valueTextColor = Color.parseColor("#ff6600")
            valueTextSize = 13f
        }

        val barData = BarData(dataSet)
        barChart.data = barData

        val description = Description()
        description.text = ""
        barChart.description = description

        barChart.axisLeft.textColor = Color.parseColor("#ff6600") // Color de los textos del eje izquierdo
        barChart.axisLeft.textSize = 12f
        barChart.axisRight.isEnabled = false // Desactivar el eje derecho
        barChart.xAxis.isEnabled = false // Desactivar el eje X
        barChart.legend.textColor = Color.parseColor("#ff6600") // Color de los textos de la leyenda
        barChart.legend.textSize = 14f

        // Disable all interactions
        barChart.setTouchEnabled(false)
        barChart.setScaleEnabled(false)
        barChart.setPinchZoom(false)
        barChart.isDoubleTapToZoomEnabled = false
        barChart.setDrawGridBackground(false)

        // Disable zooming and scrolling
        barChart.isDragEnabled = false
        barChart.setScaleEnabled(false)
        barChart.setPinchZoom(false)
        barChart.setDoubleTapToZoomEnabled(false)

        barChart.invalidate()
    }

    private fun calculateWeeklyDistance(activities: List<JSONObject>): Triple<Map<Int, Float>, String, String> {
        val calendar = Calendar.getInstance()
        val weeklyDistance = mutableMapOf<Int, Float>()
        var earliestDate: Date? = null
        var latestDate: Date? = null

        for (activity in activities) {
            val startDate = activity.getString("start_date_local")
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
            val date = sdf.parse(startDate)
            calendar.time = date

            val weekOfYear = calendar.get(Calendar.WEEK_OF_YEAR)
            val year = calendar.get(Calendar.YEAR)
            val key = year * 100 + weekOfYear

            val distance = activity.getDouble("distance").toFloat() / 1000 // Convert to kilometers

            weeklyDistance[key] = (weeklyDistance[key] ?: 0f) + distance

            if (earliestDate == null || date.before(earliestDate)) {
                earliestDate = date
            }
            if (latestDate == null || date.after(latestDate)) {
                latestDate = date
            }
        }

        val sdfOutput = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        val startDateStr = earliestDate?.let { sdfOutput.format(it) } ?: ""
        val endDateStr = latestDate?.let { sdfOutput.format(it) } ?: ""

        return Triple(weeklyDistance, startDateStr, endDateStr)
    }

    private fun calculateMonthlyDistance(activities: List<JSONObject>): Triple<Map<Int, Float>, String, String> {
        val calendar = Calendar.getInstance()
        val monthlyDistance = mutableMapOf<Int, Float>()
        var earliestDate: Date? = null
        var latestDate: Date? = null

        for (activity in activities) {
            val startDate = activity.getString("start_date_local")
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
            val date = sdf.parse(startDate)
            calendar.time = date

            val month = calendar.get(Calendar.MONTH) + 1
            val year = calendar.get(Calendar.YEAR)
            val key = year * 100 + month

            val distance = activity.getDouble("distance").toFloat() / 1000 // Convert to kilometers

            monthlyDistance[key] = (monthlyDistance[key] ?: 0f) + distance

            if (earliestDate == null || date.before(earliestDate)) {
                earliestDate = date
            }
            if (latestDate == null || date.after(latestDate)) {
                latestDate = date
            }
        }

        val sdfOutput = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        val startDateStr = earliestDate?.let { sdfOutput.format(it) } ?: ""
        val endDateStr = latestDate?.let { sdfOutput.format(it) } ?: ""

        return Triple(monthlyDistance, startDateStr, endDateStr)
    }

    private fun fetchAllStravaActivities() {
        val sharedPreferences = getSharedPreferences("StravaAuth", Context.MODE_PRIVATE)
        val accessToken = sharedPreferences.getString("access_token", null)

        if (accessToken == null) {
            return
        }

        val currentTime = System.currentTimeMillis() / 1000
        val oneYearAgo = currentTime - 365 * 24 * 60 * 60

        val url = "https://www.strava.com/api/v3/athlete/activities?before=$currentTime&after=$oneYearAgo"
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $accessToken")
            .build()

        val client = OkHttpClient()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    Log.e("MainActivity", "Error en la solicitud: ${e.message}")
                }
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    runOnUiThread {
                        Log.e("MainActivity", "Error en la respuesta: ${response.message}")
                        handleErrorResponse(response)
                    }
                    return
                }

                val responseData = response.body?.string()
                if (responseData != null) {
                    try {
                        val jsonArray = JSONArray(responseData)
                        val activities = mutableListOf<StravaAuthActivity.StravaActivity>()
                        for (i in 0 until jsonArray.length()) {
                            val activity = jsonArray.getJSONObject(i)
                            activities.add(StravaAuthActivity.StravaActivity.fromJson(activity))
                        }

                        runOnUiThread {
                            updateCharts()
                        }
                    } catch (e: JSONException) {
                        runOnUiThread {
                            Log.e("MainActivity", "Error al parsear JSON: ${e.message}")
                        }
                    }
                }
            }

            private fun handleErrorResponse(response: Response) {
                val responseData = response.body?.string()
                if (responseData != null) {
                    try {
                        val jsonObject = JSONObject(responseData)
                        val message = jsonObject.getString("message")
                        val errors = jsonObject.getJSONArray("errors")
                        runOnUiThread {
                            Log.e("MainActivity", "Error de autorización: $message")
                            for (i in 0 until errors.length()) {
                                val error = errors.getJSONObject(i)
                                val resource = error.getString("resource")
                                val field = error.getString("field")
                                val code = error.getString("code")
                                Log.e("MainActivity", "Error: $resource $field $code")
                            }
                        }
                    } catch (e: JSONException) {
                        runOnUiThread {
                            Log.e("MainActivity", "Error al parsear error JSON: ${e.message}")
                        }
                    }
                }
            }
        })
    }

    private fun setupUI(email: String?) {
        val recyclerViewUsers = findViewById<RecyclerView>(R.id.recyclerViewUsers)
        recyclerViewUsers.layoutManager = LinearLayoutManager(this)

        if (email == "antonyzanga@gmail.com") {
            // Mostrar EditText y Button para el administrador
            Log.d("MainActivity", "Usuario administrador autenticado")
            messageEditText.visibility = View.VISIBLE
            sendMessageButton.visibility = View.VISIBLE
            receivedMessageTextView.visibility = View.GONE

            // Cargar la lista de usuarios desde Firestore para el administrador
            loadUsers()
        } else {
            // Ocultar EditText y Button para usuarios no administradores
            Log.d("MainActivity", "Usuario no administrador autenticado")
            messageEditText.visibility = View.GONE
            sendMessageButton.visibility = View.GONE
            receivedMessageTextView.visibility = View.VISIBLE
        }

        val recyclerViewMessages = findViewById<RecyclerView>(R.id.recyclerViewMessages)
        recyclerViewMessages.layoutManager = LinearLayoutManager(this)
        messageList = mutableListOf()
        messageAdapter = MessageAdapter(messageList)
        recyclerViewMessages.adapter = messageAdapter

        // Cargar los mensajes recibidos desde Firestore
        loadMessages()

        if (email == "antonyzanga@gmail.com") {
            // Configurar el botón de enviar mensaje para el administrador
            sendMessageButton.setOnClickListener {
                val selectedUsers = userAdapter.getSelectedUsers()
                val messageText = messageEditText.text.toString()
                if (selectedUsers.isNotEmpty() && messageText.isNotEmpty()) {
                    sendMessageToSelectedUsers(selectedUsers, messageText)
                    messageEditText.text.clear()
                } else {
                    Toast.makeText(this, "Por favor, selecciona al menos un usuario y escribe un mensaje", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun loadUsers() {
        db.collection("users").get()
            .addOnSuccessListener { result ->
                val userList = result.map { document ->
                    User(
                        userId = document.id,
                        email = document.getString("email") ?: ""
                    )
                }
                userAdapter = UserAdapter(userList) { user ->
                    // Cargar el mensaje del usuario cuando se hace clic en él
                    loadUserMessage(user)
                }
                findViewById<RecyclerView>(R.id.recyclerViewUsers).adapter = userAdapter
                findViewById<RecyclerView>(R.id.recyclerViewUsers).visibility = View.VISIBLE
                Log.d("MainActivity", "Usuarios cargados correctamente")
            }
            .addOnFailureListener { exception ->
                Toast.makeText(this, "Error al cargar usuarios: ${exception.message}", Toast.LENGTH_SHORT).show()
                Log.e("MainActivity", "Error al cargar usuarios", exception)
            }
    }

    private fun loadUserMessage(user: User) {
        db.collection("messages")
            .whereEqualTo("receiverId", user.userId)
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(1)
            .get()
            .addOnSuccessListener { documents ->
                if (!documents.isEmpty) {
                    val message = documents.documents[0].toObject(Message::class.java)
                    message?.let {
                        receivedMessageTextView.text = it.messageText
                        receivedMessageTextView.visibility = View.VISIBLE
                    }
                } else {
                    receivedMessageTextView.text = "No hay mensajes disponibles"
                    receivedMessageTextView.visibility = View.VISIBLE
                }
            }
            .addOnFailureListener { exception ->
                Toast.makeText(this, "Error al cargar mensaje: ${exception.message}", Toast.LENGTH_SHORT).show()
                Log.e("MainActivity", "Error al cargar mensaje", exception)
            }
    }

    private fun loadMessages() {
        val currentUser = auth.currentUser?.uid ?: return

        // Consultar los mensajes enviados al usuario actual
        db.collection("messages")
            .whereEqualTo("receiverId", currentUser)
            .addSnapshotListener { snapshots, e ->
                if (e != null) {
                    Toast.makeText(this, "Error al cargar mensajes: ${e.message}", Toast.LENGTH_SHORT).show()
                    Log.e("MainActivity", "Error al cargar mensajes", e)
                    return@addSnapshotListener
                }

                if (snapshots != null) {
                    messageList.clear()
                    var lastMessage: Message? = null
                    for (doc in snapshots) {
                        val message = doc.toObject(Message::class.java)
                        if (lastMessage == null || message.timestamp > lastMessage.timestamp) {
                            lastMessage = message
                        }
                    }
                    lastMessage?.let {
                        messageList.add(it)
                        receivedMessageTextView.text = it.messageText
                        
                        // Actualizar lastMessageTime en el documento del usuario
                        db.collection("users").document(currentUser)
                            .update("lastMessageTime", it.timestamp)
                            .addOnSuccessListener {
                                Log.d("MainActivity", "lastMessageTime actualizado correctamente")
                            }
                            .addOnFailureListener { exception ->
                                Log.e("MainActivity", "Error al actualizar lastMessageTime", exception)
                            }
                    }
                    messageAdapter.notifyDataSetChanged()
                    Log.d("MainActivity", "Mensajes cargados correctamente")

                    // Eliminar mensajes anteriores
                    deletePreviousMessages(lastMessage)
                }
            }
    }

    fun getWeekTitleFromDate(timestamp: Long): String {
        val calendar = Calendar.getInstance()
        calendar.timeInMillis = timestamp

        // Ajustar el calendario al lunes más cercano
        while (calendar.get(Calendar.DAY_OF_WEEK) != Calendar.MONDAY) {
            calendar.add(Calendar.DAY_OF_WEEK, +1)
        }

        val startOfWeek = calendar.time

        // Ajustar el calendario al domingo de esa semana
        calendar.add(Calendar.DAY_OF_WEEK, 6)
        val endOfWeek = calendar.time

        val dateFormat = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        val startOfWeekStr = dateFormat.format(startOfWeek)
        val endOfWeekStr = dateFormat.format(endOfWeek)

        return "Semana desde $startOfWeekStr - $endOfWeekStr"
    }

    private fun deletePreviousMessages(lastMessage: Message?) {
        if (lastMessage != null) {
            db.collection("messages")
                .whereEqualTo("receiverId", lastMessage.receiverId)
                .get()
                .addOnSuccessListener { result ->
                    for (document in result) {
                        val message = document.toObject(Message::class.java)
                        if (message.timestamp < lastMessage.timestamp) {
                            db.collection("messages").document(document.id).delete()
                        }
                    }
                    Log.d("MainActivity", "Mensajes anteriores eliminados")
                }
                .addOnFailureListener { exception ->
                    Log.e("MainActivity", "Error al eliminar mensajes anteriores", exception)
                }
        }
    }

    private fun sendMessageToSelectedUsers(selectedUsers: List<User>, messageText: String) {
        val currentUserId = auth.currentUser?.uid ?: return

        for (user in selectedUsers) {
            val timestamp = System.currentTimeMillis()
            val title = getWeekTitleFromDate(timestamp)
            val fullMessageText = "$title\n\n$messageText" // Concatenar título y mensaje con un salto de línea
            val message = Message(
                senderId = currentUserId,
                receiverId = user.userId,
                messageText = fullMessageText,
                timestamp = timestamp,
                title = title
            )
            db.collection("messages").add(message)
                .addOnSuccessListener { documentReference ->
                    deletePreviousMessages(message)
                    Toast.makeText(this, "Mensaje enviado a ${user.email}", Toast.LENGTH_SHORT).show()
                }
                .addOnFailureListener { exception ->
                    Toast.makeText(this, "Error al enviar mensaje: ${exception.message}", Toast.LENGTH_SHORT).show()
                }
        }
    }
}
