package com.android.altovoltajerunningteam

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.firestore.FirebaseFirestore

class LoginActivity : AppCompatActivity() {

    private lateinit var auth: FirebaseAuth
    private lateinit var db: FirebaseFirestore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        // Cargar GIF usando Glide
        Glide.with(this)
            .asGif()
            .load(R.drawable.avrt) // Cambia esto a tu archivo GIF
            .into(findViewById(R.id.app_icon))

        auth = FirebaseAuth.getInstance()
        db = FirebaseFirestore.getInstance()

        val emailEditText = findViewById<EditText>(R.id.emailEditText)
        val passwordEditText = findViewById<EditText>(R.id.passwordEditText)
        val loginButton = findViewById<Button>(R.id.loginButton)

        loginButton.setOnClickListener {
            val email = emailEditText.text.toString()
            val password = passwordEditText.text.toString()

            if (email.isNotEmpty() && password.isNotEmpty()) {
                auth.createUserWithEmailAndPassword(email, password)
                    .addOnCompleteListener { task ->
                        if (task.isSuccessful) {
                            val userId = auth.currentUser?.uid
                            val user = hashMapOf(
                                "email" to email,
                                "userId" to userId
                            )

                            db.collection("users").document(userId!!)
                                .set(user)
                                .addOnSuccessListener {
                                    Toast.makeText(this, "Usuario registrado", Toast.LENGTH_SHORT).show()
                                    val intent = Intent(this, MainActivity::class.java)
                                    startActivity(intent)
                                    finish()
                                }
                                .addOnFailureListener { e ->
                                    Log.w("Firestore", "Error al guardar el usuario", e)
                                    Toast.makeText(this, "Error al guardar el usuario", Toast.LENGTH_SHORT).show()
                                }

                            // Redirigir a MainActivity después de registrar al usuario
                            // val intent = Intent(this, MainActivity::class.java)
                            // startActivity(intent)
                            // finish()
                        } else {
                            Toast.makeText(this, "Registro fallido: ${task.exception?.message}", Toast.LENGTH_SHORT).show()
                            if(task.exception?.message.toString().contains("already in use")){
                                auth.signInWithEmailAndPassword(email, password)
                                    .addOnCompleteListener(this) { task ->
                                        if (task.isSuccessful) {
                                            val intent = Intent(this, MainActivity::class.java)
                                            startActivity(intent)
                                            finish()
                                        } else {
                                            if (task.exception is FirebaseAuthInvalidUserException) {
                                                Toast.makeText(this, "Usuario no encontrado. Por favor, regístrate primero.", Toast.LENGTH_SHORT).show()
                                            } else {
                                                Toast.makeText(this, "Error al iniciar sesión: ${task.exception?.message}", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    }
                            }
                        }
                    }
            } else {
                Toast.makeText(this, "Por favor, llena todos los campos", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
