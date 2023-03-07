'use strict';

const KMT = require('./lib/KMTClass');
const syslog = require("syslog-client");
const os = require('os');


var createOptions = {
    syslogHostname: os.hostname(),
    transport: syslog.Transport.Udp,
    port: "505",
    facility: 13,
    appName : "loopIrrigazione",
    rfc3164 : false
};
var client = syslog.createClient("192.168.0.4", createOptions);

var kmt = new KMT();

// Reset Board
client.log("Invio reset board prima di inizziare irrigazione ",{severity:7});
kmt.resetBoard()
.then(result =>{
    // Stampo stato porte attuale
    return (kmt.getStatusPort())
})
.then( statusPort =>{
    client.log("Stato porte prima di iniziare irrigazione "+statusPort,{severity:7});
    return (kmt.enableBoard())
})
.then( result =>{
    client.log("Abilitazione Board ",{severity:7});
    loop(1);
})
.catch(error =>{
    client.log("Errore "+error,{severity:3});
})



function loop(zona){
   client.log("Partena zona "+zona,{severity:7});
   kmt.enableRelay(zona, function (){
       kmt.disableRelay(zona)
       .then(()=>{
           if(zona < 4)
                loop(++zona);
            else
                fineCiclo();                
       })
       .catch((error) =>{
            client.log("Errore chiusura zona. Spengo tutto "+error,{severity:0});
            kmt.resetBoard();
            process.exit(1)
       })

   })
   .then(() =>{
       client.log("Zona "+zona+" correttamente partita",{severity:7});
   })
   .catch(error =>{
       client.log("Errore partenza Zona "+error,{severity:4});
   })
}



function fineCiclo(){
    client.log("Fine ciclo irrigazione, disabilito board ",{severity:7});
    kmt.disableBoard()
    .then(() =>{
        client.log("Board disabilitata ",{severity:7});
        return (kmt.getStatusPort())
    })
    .then((statusPort) =>{
        client.log("Stato porte dopo irrigazione "+statusPort,{severity:7});
        process.exit(0);
    })
    .catch((error) =>{
        client.log("Errore "+error,{severity:4});
        process.exit(1);
    })
}
