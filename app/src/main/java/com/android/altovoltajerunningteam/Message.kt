package com.android.altovoltajerunningteam

data class Message(
    val senderId: String = "",
    val receiverId: String = "",
    val messageText: String = "",
    val timestamp: Long = System.currentTimeMillis(),
    val title: String = ""
)
