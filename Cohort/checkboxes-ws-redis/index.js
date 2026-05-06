import http from 'node:http'
import path from 'node:path'
import { Server } from 'socket.io'
import express from 'express'


const CHECKBOX_SIZE = 100
const state = {
    CHECKBOXES : new Array(CHECKBOX_SIZE).fill(false)
}


async function main() {

    const app = express()
    const server = http.createServer(app)
    const PORT = process.env.PORT ?? 8080
    const io = new Server()

    io.attach(server)

    // static files

    //socket handler
    io.on("connection",(socket)=>{
        console.log(`Socket connected `,{id:socket.id})
        //handle the (client:checkbox-change) here
        socket.on(`client:checkbox-change`,(data)=>{
            console.log(`[Socket:${socket.id}],client:checkbox-change`,data)
            const {index, checked} = data
            state.CHECKBOXES[index] = checked
            io.emit('client:checkbox-change',data)
        })
    })


    //express handler
    
    app.use(express.static(path.resolve('./public')))

    app.get('/health', (req, res) =>
        res.json({ healthy: true })
    )

    app.get('/checkboxes',(req,res)=>{
        return res.json({checkboxes:state.CHECKBOXES})
    })

    server.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`)
    })
}

main()