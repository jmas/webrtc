//our username
var name;
var connectedUser;

//connecting to our signaling server
var conn = new WebSocket("wss://192.168.0.103:9090");

conn.onopen = function () {
  console.log("Connected to the signaling server");
};

//when we got a message from a signaling server
conn.onmessage = function (msg) {
  console.log("Got message", msg.data);
  var data = JSON.parse(msg.data);

  switch (data.type) {
    case "login":
      handleLogin(data.success);
      break;
    //when somebody wants to call us
    case "offer":
      handleOffer(data.offer, data.name);
      break;
    case "answer":
      handleAnswer(data.answer);
      break;
    //when a remote peer sends an ice candidate to us
    case "candidate":
      handleCandidate(data.candidate);
      break;
    case "leave":
      handleLeave();
      break;
    default:
      break;
  }
};

conn.addEventListener("close", (e) => {
  alert(e.code + " - " + e.reason);
});

conn.onerror = function (err) {
  alert("Got error: " + JSON.stringify(err));
};

//alias for sending JSON encoded messages
function send(message) {
  //attach the other peer username to our messages
  if (connectedUser) {
    message.name = connectedUser;
  }

  conn.send(JSON.stringify(message));
}

//******
//UI selectors block
//******

var loginPage = document.querySelector("#loginPage");
var usernameInput = document.querySelector("#usernameInput");
var loginBtn = document.querySelector("#loginBtn");

var callPage = document.querySelector("#callPage");
var callToUsernameInput = document.querySelector("#callToUsernameInput");
var callBtn = document.querySelector("#callBtn");

var hangUpBtn = document.querySelector("#hangUpBtn");
var localAudio = document.querySelector("#localAudio");
var remoteAudio = document.querySelector("#remoteAudio");

var yourConn;
var stream;

callPage.style.display = "none";

// Login when the user clicks the button
loginBtn.addEventListener("click", function (event) {
  name = usernameInput.value;

  if (name.length > 0) {
    send({
      type: "login",
      name: name,
    });
  }
});

function handleLogin(success) {
  if (success === false) {
    alert("Ooops...try a different username");
  } else {
    loginPage.style.display = "none";
    callPage.style.display = "block";

    //**********************
    //Starting a peer connection
    //**********************

    //getting local audio stream
    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then(
      function (myStream) {
        stream = myStream;
        console.log(myStream);
        //displaying local audio stream on the page
        // localAudio.src = window.HTMLMediaElement.srcObject(stream); // window.URL.createObjectURL(stream);

        try {
          this.srcObject = stream;
        } catch (error) {
          this.src = window.URL.createObjectURL(stream);
        }

        //using Google public stun server
        var configuration = {
          iceServers: [{ urls: "stun:stun2.1.google.com:19302" }],
        };

        yourConn = new RTCPeerConnection(configuration);

        stream.getTracks().forEach((track) => yourConn.addTrack(track, stream));

        // setup stream listening
        // yourConn.addStream(stream);

        //when a remote user adds stream to the peer connection, we display it
        yourConn.onaddstream = function (e) {
          try {
            remoteAudio.srcObject = stream;
          } catch (error) {
            remoteAudio.src = window.URL.createObjectURL(stream);
          }

          // remoteAudio.src = window.URL.createObjectURL(e.stream);
        };

        // Setup ice handling
        yourConn.onicecandidate = function (event) {
          if (event.candidate) {
            send({
              type: "candidate",
              candidate: event.candidate,
            });
          }
        };
      },
      function (error) {
        console.log(error);
      }
    );
  }
}

//initiating a call
callBtn.addEventListener("click", function () {
  var callToUsername = callToUsernameInput.value;

  if (callToUsername.length > 0) {
    connectedUser = callToUsername;

    // create an offer
    yourConn.createOffer(
      function (offer) {
        send({
          type: "offer",
          offer: offer,
        });

        yourConn.setLocalDescription(offer);
      },
      function (error) {
        alert("Error when creating an offer");
      }
    );
  }
});

//when somebody sends us an offer
function handleOffer(offer, name) {
  connectedUser = name;
  yourConn.setRemoteDescription(new RTCSessionDescription(offer));

  //create an answer to an offer
  yourConn.createAnswer(
    function (answer) {
      yourConn.setLocalDescription(answer);

      send({
        type: "answer",
        answer: answer,
      });
    },
    function (error) {
      alert("Error when creating an answer");
    }
  );
}

//when we got an answer from a remote user
function handleAnswer(answer) {
  yourConn.setRemoteDescription(new RTCSessionDescription(answer));
}

//when we got an ice candidate from a remote user
function handleCandidate(candidate) {
  yourConn.addIceCandidate(new RTCIceCandidate(candidate));
}

//hang up
hangUpBtn.addEventListener("click", function () {
  send({
    type: "leave",
  });

  handleLeave();
});

function handleLeave() {
  connectedUser = null;
  remoteAudio.src = null;

  yourConn.close();
  yourConn.onicecandidate = null;
  yourConn.onaddstream = null;
}
