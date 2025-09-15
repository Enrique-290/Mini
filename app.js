const pines = {Admin: "1234", Cajero: "0000"};

function login(){
  const usuario = document.getElementById("usuario").value;
  const pin = document.getElementById("pin").value;
  if(pines[usuario] && pines[usuario] === pin){
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "flex";
  } else {
    alert("Usuario o PIN incorrecto");
  }
}

function resetPin(){
  alert("PINs restablecidos: Admin 1234, Cajero 0000");
}

function mostrar(id){
  document.querySelectorAll(".seccion").forEach(s => s.style.display="none");
  document.getElementById(id).style.display="block";
}