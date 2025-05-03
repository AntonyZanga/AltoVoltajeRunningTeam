package com.android.altovoltajerunningteam

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import org.json.JSONObject
import java.io.IOException
import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONException

class StravaAuthActivity : AppCompatActivity() {

    private val clientId = "127124"
    private val clientSecret = "50825ee5414cc703024485e972996e8a1fd8131b"
    private val redirectUri = "https://localhost/AltoVoltajeRunningTeam/"
    private val authorizationUrl = "https://www.strava.com/oauth/mobile/authorize"
    private val tokenUrl = "https://www.strava.com/oauth/token"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (intent?.data == null) {
            val intentUri = Uri.parse(authorizationUrl)
                .buildUpon()
                .appendQueryParameter("client_id", clientId)
                .appendQueryParameter("redirect_uri", redirectUri)
                .appendQueryParameter("response_type", "code")
                .appendQueryParameter("approval_prompt", "auto")
                .appendQueryParameter("scope", "read,activity:read_all")
                .build()

            val intent = Intent(Intent.ACTION_VIEW, intentUri)
            startActivity(intent)
        } else {
            handleIntent(intent)
        }
    }

    fun fetchLatestActivity(context: Context, callback: (StravaActivity?) -> Unit) {
        val sharedPreferences = context.getSharedPreferences("StravaAuth", Context.MODE_PRIVATE)
        val accessToken = sharedPreferences.getString("access_token", null)

        if (accessToken == null) {
            callback(null)
            return
        }

        val url = "https://www.strava.com/api/v3/athlete/activities"
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $accessToken")
            .build()

        val client = OkHttpClient()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("StravaAuthActivity", "Error en la solicitud: ${e.message}")
                callback(null)
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    Log.e("StravaAuthActivity", "Error en la respuesta: ${response.message}")
                    handleErrorResponse(response)
                    callback(null)
                    return
                }

                val responseData = response.body?.string()
                if (responseData != null) {
                    try {
                        val jsonArray = JSONArray(responseData)
                        if (jsonArray.length() > 0) {
                            val latestActivity = jsonArray.getJSONObject(0)
                            val stravaActivity = StravaActivity.fromJson(latestActivity)

                            callback(stravaActivity)
                        } else {
                            callback(null)
                        }
                    } catch (e: JSONException) {
                        Log.e("StravaAuthActivity", "Error al parsear JSON: ${e.message}")
                        callback(null)
                    }
                } else {
                    callback(null)
                }
            }

            private fun handleErrorResponse(response: Response) {
                val responseData = response.body?.string()
                if (responseData != null) {
                    try {
                        val jsonObject = JSONObject(responseData)
                        val message = jsonObject.getString("message")
                        val errors = jsonObject.getJSONArray("errors")
                        Log.e("StravaAuthActivity", "Error de autorización: $message")
                        for (i in 0 until errors.length()) {
                            val error = errors.getJSONObject(i)
                            val resource = error.getString("resource")
                            val field = error.getString("field")
                            val code = error.getString("code")
                            Log.e("StravaAuthActivity", "Error: $resource $field $code")
                        }
                    } catch (e: JSONException) {
                        Log.e("StravaAuthActivity", "Error al parsear error JSON: ${e.message}")
                    }
                }
            }
        })
    }

    fun fetchActivitiesForLastDay(context: Context, callback: (List<StravaActivity>?) -> Unit) {
        val sharedPreferences = context.getSharedPreferences("StravaAuth", Context.MODE_PRIVATE)
        val accessToken = sharedPreferences.getString("access_token", null)

        if (accessToken == null) {
            callback(null)
            return
        }

        val currentTime = System.currentTimeMillis() / 1000
        val yesterdayTime = currentTime - 24 * 60 * 60

        val url = "https://www.strava.com/api/v3/athlete/activities?after=$yesterdayTime"
        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer $accessToken")
            .build()

        val client = OkHttpClient()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("StravaAuthActivity", "Error en la solicitud: ${e.message}")
                callback(null)
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    Log.e("StravaAuthActivity", "Error en la respuesta: ${response.message}")
                    handleErrorResponse(response)
                    callback(null)
                    return
                }

                val responseData = response.body?.string()
                if (responseData != null) {
                    try {
                        val jsonArray = JSONArray(responseData)
                        val activities = mutableListOf<StravaActivity>()
                        for (i in 0 until jsonArray.length()) {
                            val activity = jsonArray.getJSONObject(i)
                            activities.add(StravaActivity.fromJson(activity))
                        }
                        callback(activities)
                    } catch (e: JSONException) {
                        Log.e("StravaAuthActivity", "Error al parsear JSON: ${e.message}")
                        callback(null)
                    }
                } else {
                    callback(null)
                }
            }

            private fun handleErrorResponse(response: Response) {
                val responseData = response.body?.string()
                if (responseData != null) {
                    try {
                        val jsonObject = JSONObject(responseData)
                        val message = jsonObject.getString("message")
                        val errors = jsonObject.getJSONArray("errors")
                        Log.e("StravaAuthActivity", "Error de autorización: $message")
                        for (i in 0 until errors.length()) {
                            val error = errors.getJSONObject(i)
                            val resource = error.getString("resource")
                            val field = error.getString("field")
                            val code = error.getString("code")
                            Log.e("StravaAuthActivity", "Error: $resource $field $code")
                        }
                    } catch (e: JSONException) {
                        Log.e("StravaAuthActivity", "Error al parsear error JSON: ${e.message}")
                    }
                }
            }
        })
    }

    fun fetchAllActivities(context: Context, callback: (List<StravaActivity>?) -> Unit) {
        val sharedPreferences = context.getSharedPreferences("StravaAuth", Context.MODE_PRIVATE)
        val accessToken = sharedPreferences.getString("access_token", null)

        if (accessToken == null) {
            callback(null)
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
                Log.e("StravaAuthActivity", "Error en la solicitud: ${e.message}")
                callback(null)
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) {
                    Log.e("StravaAuthActivity", "Error en la respuesta: ${response.message}")
                    handleErrorResponse(response)
                    callback(null)
                    return
                }

                val responseData = response.body?.string()
                if (responseData != null) {
                    try {
                        val jsonArray = JSONArray(responseData)
                        val activities = mutableListOf<StravaActivity>()
                        for (i in 0 until jsonArray.length()) {
                            val activity = jsonArray.getJSONObject(i)
                            activities.add(StravaActivity.fromJson(activity))
                        }
                        callback(activities)
                    } catch (e: JSONException) {
                        Log.e("StravaAuthActivity", "Error al parsear JSON: ${e.message}")
                        callback(null)
                    }
                } else {
                    callback(null)
                }
            }

            private fun handleErrorResponse(response: Response) {
                val responseData = response.body?.string()
                if (responseData != null) {
                    try {
                        val jsonObject = JSONObject(responseData)
                        val message = jsonObject.getString("message")
                        val errors = jsonObject.getJSONArray("errors")
                        Log.e("StravaAuthActivity", "Error de autorización: $message")
                        for (i in 0 until errors.length()) {
                            val error = errors.getJSONObject(i)
                            val resource = error.getString("resource")
                            val field = error.getString("field")
                            val code = error.getString("code")
                            Log.e("StravaAuthActivity", "Error: $resource $field $code")
                        }
                    } catch (e: JSONException) {
                        Log.e("StravaAuthActivity", "Error al parsear error JSON: ${e.message}")
                    }
                }
            }
        })
    }

    data class StravaActivity(
        val name: String,
        val distance: Double,
        val movingTime: Int,
        val elapsedTime: Int,
        val averageSpeed: Double,
        val startDate: String,
    ) {
        companion object {
            fun fromJson(jsonObject: JSONObject): StravaActivity {
                return StravaActivity(
                    name = jsonObject.getString("name"),
                    distance = jsonObject.getDouble("distance"),
                    movingTime = jsonObject.getInt("moving_time"),
                    elapsedTime = jsonObject.getInt("elapsed_time"),
                    averageSpeed = jsonObject.getDouble("average_speed"),
                    startDate = jsonObject.getString("start_date_local"),
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        intent?.data?.let { uri ->
            if (uri.toString().startsWith(redirectUri)) {
                val code = uri.getQueryParameter("code")
                code?.let { fetchAccessToken(it) }
            }
        }
    }

    private fun fetchAccessToken(code: String) {
        val client = OkHttpClient()
        val requestBody = FormBody.Builder()
            .add("client_id", clientId)
            .add("client_secret", clientSecret)
            .add("code", code)
            .add("grant_type", "authorization_code")
            .build()

        val request = Request.Builder()
            .url(tokenUrl)
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    e.printStackTrace()
                    Toast.makeText(this@StravaAuthActivity, "Error de autenticación", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                response.body?.string()?.let {
                    val json = JSONObject(it)
                    val accessToken = json.getString("access_token")
                    val refreshToken = json.getString("refresh_token")
                    val expiresAt = json.getLong("expires_at")

                    saveTokens(accessToken, refreshToken, expiresAt)

                    runOnUiThread {
                        Toast.makeText(this@StravaAuthActivity, "Autenticación completada", Toast.LENGTH_SHORT).show()
                        // Ahora finaliza StravaAuthActivity y abre MainActivity
                        val intent = Intent(this@StravaAuthActivity, MainActivity::class.java)
                        startActivity(intent)
                        finish()
                    }

                }
            }
        })

    }

    private fun saveTokens(accessToken: String, refreshToken: String, expiresAt: Long) {
        val sharedPreferences = getSharedPreferences("StravaAuth", MODE_PRIVATE)
        with(sharedPreferences.edit()) {
            putString("access_token", accessToken)
            putString("refresh_token", refreshToken)
            putLong("expires_at", expiresAt)
            apply()
        }
    }

    private fun refreshTokenIfNeeded(context: Context, callback: (String?) -> Unit) {
        val sharedPreferences = context.getSharedPreferences("StravaAuth", MODE_PRIVATE)
        val accessToken = sharedPreferences.getString("access_token", null)
        val refreshToken = sharedPreferences.getString("refresh_token", null)
        val expiresAt = sharedPreferences.getLong("expires_at", 0)
        val currentTime = System.currentTimeMillis() / 1000

        if (accessToken != null && refreshToken != null) {
            if (currentTime >= expiresAt) {
                // Token has expired, refresh it
                refreshAccessToken(context, refreshToken, callback)
            } else {
                // Token is still valid
                callback(accessToken)
            }
        } else {
            // No token available
            callback(null)
        }
    }

    private fun refreshAccessToken(context: Context, refreshToken: String, callback: (String?) -> Unit) {
        val client = OkHttpClient()
        val requestBody = FormBody.Builder()
            .add("client_id", clientId)
            .add("client_secret", clientSecret)
            .add("refresh_token", refreshToken)
            .add("grant_type", "refresh_token")
            .build()

        val request = Request.Builder()
            .url(tokenUrl)
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(null)
            }

            override fun onResponse(call: Call, response: Response) {
                response.body?.string()?.let {
                    val json = JSONObject(it)
                    val newAccessToken = json.getString("access_token")
                    val newRefreshToken = json.getString("refresh_token")
                    val newExpiresAt = json.getLong("expires_at")

                    saveTokens(newAccessToken, newRefreshToken, newExpiresAt)

                    callback(newAccessToken)
                } ?: run {
                    callback(null)
                }
            }
        })
    }
}
