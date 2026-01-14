<script setup>
import { ref, watch, nextTick } from "vue";
import { useUserStore } from "@/stores/user";
import { useChatStore } from "@/stores/chat";
import api, { baseURL } from "@/api/axios";
import MyButton from "./MyButton.vue";



const props = defineProps({
  receiverId: { type: Number, required: true },
});

const userStore = useUserStore();
const chat = useChatStore();

const text = ref("");

const messagesContainer = ref(null);


// init socket + charger historique
watch(
  () => props.receiverId,
  async (id) => {
    if (!id || !userStore.user) return;

    chat.init(userStore.user.user_id);
    await chat.loadHistory(id);

    // ✅ ICI EXACTEMENT 👇
    await api.post(`/messages/mark-read/${id}`);
    userStore.unreadMessagesCount = 0;

    const res = await api.get(`/auth/users/${id}`);
    receiver.value = res.data;

    await nextTick();
    messagesContainer.value.scrollTop =
      messagesContainer.value.scrollHeight;
          // ✅ backend

  },
  { immediate: true }
);



// auto-scroll
let previousLength = 0;

watch(
  () => chat.messages.length,
  async (newLength) => {
    if (!messagesContainer.value) return;

    // 🔥 seulement si un message est ajouté (pas au chargement)
    if (newLength > previousLength) {
      await nextTick();
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: "smooth",
      });
    }

    previousLength = newLength;
  }
);


const send = () => {
  if (!text.value.trim()) return;
  chat.sendMessage(userStore.user.user_id, text.value);
  text.value = "";
};

const formatTime = (date) => {
  if (!date) return "";
  
  // 🕒 Correction UTC : si la date n'a pas de "Z" ni de fuseau, on ajoute "Z"
  // pour dire au navigateur "C'est une date UTC, convertis-la en heure FR"
  let dateObj = new Date(date);
  if (typeof date === "string" && !date.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(date)) {
    dateObj = new Date(date + "Z");
  }

  return dateObj.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
};


const receiver = ref(null);

const fileInput = ref(null);

const isSendingImage = ref(false);

const sendImage = async (file) => {
  if (!file) return;

  isSendingImage.value = true;
  try {
    const formData = new FormData();
    formData.append("image", file);

    const res = await api.post("/messages/image", formData);

    chat.sendMessage(
      userStore.user.user_id,
      res.data.image_url,
      res.data.image_url
    );
  } catch (e) {
    console.error(e);
  } finally {
    isSendingImage.value = false;
  }
};

// 🕵️‍♀️ Détecter si le message est une image
const isImageUrl = (text) => {
  if (!text) return false;
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(text);
};

const imageError = ref(false);
</script>

<template>
  <section class="flex flex-col flex-1 ">

    <!-- HEADER -->
   <header class="h-14 bg-white flex items-center px-4 gap-3 ">
      <!-- ... (header inchangé) ... -->
      <button @click="$emit('back')" class="lg:hidden text-blue-600 font-medium">
        ←
      </button>

      <!-- INFOS (Clickable) -->
      <router-link :to="`/profil/${receiverId}`" class="flex items-center gap-3 hover:opacity-80 transition cursor-pointer">
        <!-- AVATAR -->
        <div class="w-10 h-10 overflow-hidden border border-blue-plumepixel flex-shrink-0 flex items-center justify-center text-white font-bold uppercase"
             :style="{ backgroundColor: 'var(--color-blue-plumepixel)' }">
          <img v-if="receiver?.avatar" 
               v-show="!imageError"
               @error="imageError = true"
               :src="receiver.avatar.startsWith('http') ? receiver.avatar : `${baseURL}${receiver.avatar}`" 
               class="w-full h-full object-cover" />
          <span v-if="!receiver?.avatar || imageError">{{ receiver?.username?.charAt(0) || '?' }}</span>
        </div>

        <div>
           <div class="font-semibold text-black">
             {{ receiver?.first_name }} {{ receiver?.last_name }}
           </div>
           <div class="text-xs text-gray-500">
             @{{ receiver?.username }}
           </div>
        </div>
      </router-link>
    </header>

    <!-- MESSAGES -->
    <main ref="messagesContainer" class="flex-1 overflow-y-auto py-6">
      <div class="max-w-3xl mx-auto px-4 space-y-4">

<div
  v-for="(m, i) in chat.messages"
  :key="m.id || i"
  class="flex"
  :class="m.sender_id === userStore.user.user_id ? 'justify-end' : 'justify-start'"
>
  <div
    :class="[
      'max-w-[65%] px-3 py-2 text-sm border',
      m.sender_id === userStore.user.user_id
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-gray-800 border-blue-600'
    ]"
  >
    
    <!-- 🖼️ IMAGE (soit via m.image_url, soit via m.content si c'est une URL) -->
   <img
    v-if="m.image_url || isImageUrl(m.content)"
    :src="(m.image_url || m.content).startsWith('http') ? (m.image_url || m.content) : `${baseURL}${(m.image_url || m.content)}`"
    class="max-w-full mb-1"
  />

    <!-- 💬 TEXTE (seulement si ce n'est PAS une image) -->
    <p
      v-if="m.content && !isImageUrl(m.content)"
      class="whitespace-pre-line break-words"
    >
      {{ m.content }}
    </p>

    <!-- ⏱️ HEURE -->
    <div class="mt-1 text-[10px] opacity-60 text-right">
      {{ formatTime(m.created_at) }}
    </div>
  </div>
</div>


      </div>
    </main>

    <!-- INPUT -->
    <footer class=" bg-white py-3">
      <div class="max-w-3xl mx-auto px-4 flex items-center gap-3">
        <input ref="fileInput" type="file" accept="image/*" class="hidden"
          @change="e => sendImage(e.target.files[0])" />

        <button @click="fileInput.click()" class="border border-blue-600 px-3 py-2 text-blue-600
         hover:bg-blue-600 hover:text-white transition"
         :disabled="isSendingImage">
          <span v-if="isSendingImage" class="animate-spin inline-block">⏳</span>
          <span v-else>📷</span>
        </button>
        <input v-model="text" @keyup.enter="send" placeholder="Écrire un message…" class="flex-1 bg-transparent border border-blue-600 px-4 py-2 outline-none
                 focus:ring-1 focus:ring-blue-600" />
        <MyButton @click="send" :style="{ backgroundColor: 'var(--color-blue-plumepixel)' }">
          Envoyer
        </MyButton>
      </div>
    </footer>

  </section>
</template>


<style scoped>
.message-enter-active {
  transition: all 0.25s ease;
}

.message-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
</style>
