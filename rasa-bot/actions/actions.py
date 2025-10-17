from typing import Dict, Text, Any, List
from rasa_sdk import Action, Tracker, FormValidationAction
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import AllSlotsReset, SlotSet, EventType
from rasa_sdk.types import DomainDict
import requests
import logging

logger = logging.getLogger(__name__)

class ActionDefaultFallback(Action):
    """Acción de fallback cuando no se entiende el mensaje del usuario."""
    
    def name(self) -> Text:
        return "action_default_fallback"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        dispatcher.utter_message(template="utter_fallback")
        return []


class ActionSolicitarPago(Action):
    """
    Acción para solicitar el pago del manifiesto al cliente.
    
    FLUJO FUTURO: Genera QR de Nequi y espera webhook
    FLUJO ACTUAL: Muestra información manual de pago
    """
    
    def name(self) -> Text:
        return "action_solicitar_pago"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        
        monto = "8000"
        sender_id = tracker.sender_id
        
        logger.info(f"💳 Solicitando pago al cliente {sender_id}")
        logger.info(f"  💰 Monto: ${monto} COP")
        
        # TODO: INTEGRACIÓN FUTURA CON NEQUI
        # qr_code = generar_qr_nequi(monto, sender_id)
        # enviar_qr_por_whatsapp(sender_id, qr_code)
        # guardar_transaccion_pendiente(sender_id, monto)
        
        mensaje = (
            "Para finalizar, el valor del manifiesto es de $8.000 pesos.\n\n"
            "💳 Por favor realiza el pago a la siguiente cuenta Nequi:\n"
            "📱 Número: 3106806180\n"
            "💰 Valor: $8.000\n\n"
            "Una vez realices el pago, envíame el comprobante para procesar tu manifiesto. ¡Gracias!"
        )
        
        dispatcher.utter_message(text=mensaje)
        
        return [
            SlotSet("pago_pendiente", True),
            SlotSet("monto_total", monto)
        ]


class ActionConfirmarPago(Action):
    """
    Acción para confirmar que se recibió el pago del cliente.
    
    FLUJO FUTURO: Se activa automáticamente por webhook
    FLUJO ACTUAL: Cliente confirma manualmente
    """
    
    def name(self) -> Text:
        return "action_confirmar_pago"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        
        monto = tracker.get_slot("monto_total") or "8000"
        sender_id = tracker.sender_id
        
        logger.info(f"✅ Confirmando pago recibido del cliente {sender_id}")
        logger.info(f"  💰 Monto: ${monto} COP")
        
        # TODO: INTEGRACIÓN FUTURA
        # validar_pago_en_db(sender_id, monto)
        # marcar_transaccion_como_pagada(sender_id)
        
        mensaje = (
            "¡Perfecto! He recibido tu comprobante de pago. ✅\n\n"
            "Ya puedo proceder con la generación de tu manifiesto.\n"
            "En breve te enviaré el documento completo. ¡Muchas gracias por tu pago!"
        )
        
        dispatcher.utter_message(text=mensaje)
        
        return [
            SlotSet("pago_pendiente", False),
            SlotSet("monto_total", None)
        ]


class ActionGenerarManifiesto(Action):
    """
    Acción para generar el manifiesto usando Playwright.
    Llama al bot de Playwright para automatizar la generación del documento.
    """
    
    def name(self) -> Text:
        return "action_generar_manifiesto"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        
        datos_manifiesto = {
            "flete": tracker.get_slot("flete"),
            "descripcion": tracker.get_slot("descripcion"),
            "peso": tracker.get_slot("peso"),
            "fecha_cargue": tracker.get_slot("fecha_cargue"),
            "fecha_descargue": tracker.get_slot("fecha_descargue"),
            "tarjeta": tracker.get_slot("tarjeta"),
            "licencia": tracker.get_slot("licencia"),
            "origen": tracker.get_slot("origen"),
            "destino": tracker.get_slot("destino"),
            "cliente_id": tracker.sender_id
        }
        
        logger.info(f"🤖 Generando manifiesto con Playwright para {tracker.sender_id}")
        logger.info(f"  📋 Datos: {datos_manifiesto}")
        
        try:
            # TODO: LLAMADA A PLAYWRIGHT
            # playwright_url = "http://playwright:3000/generar-manifiesto"
            # response = requests.post(playwright_url, json=datos_manifiesto, timeout=30)
            # if response.status_code == 200:
            #     resultado = response.json()
            #     pdf_url = resultado.get("pdf_url")
            #     enviar_pdf_por_whatsapp(tracker.sender_id, pdf_url)
            
            mensaje = (
                "✅ ¡Manifiesto generado exitosamente! 📋\n\n"
                "Tu documento está siendo procesado y te lo enviaré en un momento.\n"
                "Gracias por usar nuestros servicios. 😊"
            )
            
            dispatcher.utter_message(text=mensaje)
            return [AllSlotsReset()]
            
        except Exception as e:
            logger.error(f"❌ Error al generar manifiesto: {str(e)}")
            
            mensaje = (
                "Lo siento, hubo un error al procesar tu manifiesto. 😔\n\n"
                "Por favor, intenta nuevamente o contacta con soporte."
            )
            
            dispatcher.utter_message(text=mensaje)
            return []


class ActionSubmitManifiesto(Action):
    """Acción que se ejecuta cuando se completa el formulario de manifiesto."""
    
    def name(self) -> Text:
        return "action_submit_manifiesto"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[EventType]:
        
        flete = tracker.get_slot("flete")
        descripcion = tracker.get_slot("descripcion")
        peso = tracker.get_slot("peso")
        fecha_cargue = tracker.get_slot("fecha_cargue")
        fecha_descargue = tracker.get_slot("fecha_descargue")
        tarjeta = tracker.get_slot("tarjeta")
        licencia = tracker.get_slot("licencia")
        origen = tracker.get_slot("origen")
        destino = tracker.get_slot("destino")
        
        logger.info(f"📋 Resumen de manifiesto para {tracker.sender_id}:")
        logger.info(f"  💰 Flete: {flete}")
        logger.info(f"  📦 Descripción: {descripcion}")
        logger.info(f"  ⚖️ Peso: {peso}")
        logger.info(f"  📅 Cargue: {fecha_cargue} | Descargue: {fecha_descargue}")
        logger.info(f"  📍 Ruta: {origen} → {destino}")
        
        try:
            flete_formateado = f"${int(flete):,}".replace(",", ".")
        except:
            flete_formateado = f"${flete}"
        
        mensaje = (
            f"Excelente, he recibido toda la información para tu manifiesto:\n\n"
            f"📍 *Ruta:* {origen} → {destino}\n"
            f"📦 *Carga:* {descripcion}\n"
            f"⚖️ *Peso:* {peso}\n"
            f"💰 *Flete:* {flete_formateado}\n"
            f"📅 *Cargue:* {fecha_cargue}\n"
            f"📅 *Descargue:* {fecha_descargue}\n"
            f"🚗 *Vehículo:* {tarjeta}\n"
            f"🪪 *Conductor:* {licencia}\n\n"
            f"✅ Todo listo para procesar tu solicitud."
        )
        
        dispatcher.utter_message(text=mensaje)
        return []


class ValidateManifiestoForm(FormValidationAction):
    """Validador para el formulario de manifiesto."""
    
    def name(self) -> Text:
        return "validate_manifiesto_form"

    def validate_flete(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de flete."""
        if slot_value is None:
            return {"flete": None}
        
        clean_value = str(slot_value).replace("$", "").replace(",", "").replace(".", "").replace("'", "").strip()
        
        if clean_value.isdigit():
            formatted = f"{int(clean_value):,}".replace(",", ".")
            dispatcher.utter_message(text=f"✅ Flete registrado: ${formatted}")
            return {"flete": clean_value}
        else:
            dispatcher.utter_message(
                text="Lo siento, el flete debe ser un valor numérico.\n\n"
                     "Por favor, intenta de nuevo.\nEjemplo: 150000 o $150.000"
            )
            return {"flete": None}

    def validate_peso(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de peso."""
        if slot_value is None:
            return {"peso": None}
        
        clean_value = str(slot_value).lower()
        
        for word in ["kg", "kilos", "kilogramos", "toneladas", "ton", "t"]:
            clean_value = clean_value.replace(word, "").strip()
        
        try:
            peso_num = float(clean_value.replace(",", "."))
            dispatcher.utter_message(text=f"✅ Peso registrado: {slot_value}")
            return {"peso": slot_value}
        except ValueError:
            dispatcher.utter_message(
                text="Disculpa, el peso debe ser un valor numérico.\n\n"
                     "Por favor, intenta nuevamente.\nEjemplo: 500 kg, 4.5 toneladas, 2000"
            )
            return {"peso": None}

    def validate_origen(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de origen."""
        if slot_value and len(str(slot_value).strip()) > 0:
            dispatcher.utter_message(text=f"✅ Origen registrado: {slot_value}")
            return {"origen": slot_value}
        return {"origen": None}

    def validate_destino(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de destino."""
        if slot_value and len(str(slot_value).strip()) > 0:
            dispatcher.utter_message(text=f"✅ Destino registrado: {slot_value}")
            return {"destino": slot_value}
        return {"destino": None}

    def validate_descripcion(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de descripción."""
        if slot_value and len(str(slot_value).strip()) > 0:
            dispatcher.utter_message(text=f"✅ Carga registrada: {slot_value}")
            return {"descripcion": slot_value}
        return {"descripcion": None}

    def validate_fecha_cargue(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de fecha de cargue."""
        if slot_value and len(str(slot_value).strip()) > 0:
            dispatcher.utter_message(text=f"✅ Fecha de cargue registrada: {slot_value}")
            return {"fecha_cargue": slot_value}
        return {"fecha_cargue": None}

    def validate_fecha_descargue(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de fecha de descargue."""
        if slot_value and len(str(slot_value).strip()) > 0:
            dispatcher.utter_message(text=f"✅ Fecha de descargue registrada: {slot_value}")
            return {"fecha_descargue": slot_value}
        return {"fecha_descargue": None}

    def validate_tarjeta(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de tarjeta de propiedad."""
        if slot_value and len(str(slot_value).strip()) > 0:
            dispatcher.utter_message(text="✅ Información del vehículo recibida")
            return {"tarjeta": slot_value}
        return {"tarjeta": None}

    def validate_licencia(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        """Valida el slot de licencia de conducción."""
        if slot_value and len(str(slot_value).strip()) > 0:
            dispatcher.utter_message(text="✅ Información del conductor recibida")
            return {"licencia": slot_value}
        return {"licencia": None}